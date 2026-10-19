import {
  BillingCycle,
  Category,
  NormalizedTransaction,
  RecurringCandidate,
  ValueRating,
} from '../types';
import { differenceInDays, parseISO } from 'date-fns';
import { clusterTransactionsBySimilarity, findBrand } from './merchantMatcher';
import { rollForwardRenewalDate } from './dates';

interface Cadence {
  cycle: BillingCycle;
  days: number;
  tolerance: number;
}

const CADENCES: Cadence[] = [
  { cycle: 'custom', days: 7, tolerance: 2 },
  { cycle: 'monthly', days: 30, tolerance: 5 },
  { cycle: 'quarterly', days: 91, tolerance: 12 },
  { cycle: 'yearly', days: 365, tolerance: 25 },
];

// Regular payments that are not subscriptions: loans, rent, investments, bills,
// cash, fuel and money sent to people. Only checked for merchants we don't know.
const NOT_A_SUBSCRIPTION =
  /\b(emi|loan|rent|rental|\bsip\b|mutual ?fund|nach|ach ?dr?|insurance|lic|policy|credit ?card|cc ?(bill|payment)|card ?payment|atm|cash|neft|imps|rtgs|salary|fd|rd|ppf|nps|tax|gst|challan|school|college|tuition|fees?|electricity|bescom|msedcl|tneb|water ?bill|gas ?bill|petrol|diesel|fuel|hpcl|iocl|bpcl|indian ?oil|bharat ?petroleum|self ?transfer|own ?account)\b/i;
// UPI to a person: phone-number VPAs, Google Pay personal handles, P2P/P2A tags
const PERSON_TRANSFER = /\b\d{10}@|@ok(axis|sbi|hdfcbank|icici)\b|\bP2[AP]\b/i;
// An unknown merchant only counts when its narration looks like a paid plan or an
// online service. Without this, a milkman, maid or tiffin paid the same amount
// every month would show up as a "subscription".
const SUBSCRIPTION_SIGNAL =
  /subscri|membership|member ?fee|premium|renewal|recurring|auto ?pay|auto ?debit|autopay|mandate|standing ?instruction|\bsi\b|\bplan\b|\bpro\b|\bplus\b|\.com\b|\.io\b|\.ai\b|\.app\b|www\.|\bsaas\b|\bcloud\b|\bhosting\b|\bdomain\b|\bvpn\b|app ?store|play ?store|itunes|paddle|stripe|fastspring|gumroad|patreon|lemon ?squeezy|\bott\b|\bstream/i;

/** Median, so one skipped month (60 days) doesn't break a monthly pattern */
function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Indian prepaid mobile plans (Jio, Airtel, Vi) renew every 28 days, not monthly.
// Saving them as monthly would make reminders drift two days a month.
const PREPAID_28: Cadence = { cycle: 'custom', days: 28, tolerance: 1 };

function matchCadence(intervals: number[]): { cadence: Cadence; regular: boolean } | null {
  if (intervals.length === 0) return null;
  if (intervals.length >= 2 && intervals.every((g) => Math.abs(g - 28) <= 1)) {
    return { cadence: PREPAID_28, regular: true };
  }
  const med = median(intervals);
  const cadence = CADENCES.find((c) => Math.abs(med - c.days) <= c.tolerance);
  if (!cadence) return null;
  // Regular when each gap is one cycle, or a whole number of cycles (a missed month)
  const regular = intervals.every((gap) => {
    const k = Math.max(1, Math.round(gap / cadence.days));
    return k <= 3 && Math.abs(gap - k * cadence.days) <= cadence.tolerance * k;
  });
  return { cadence, regular };
}

/** Amounts the same within 15%, or one price change (e.g. 129 -> 149) */
function amountsConsistent(amounts: number[]): boolean {
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  if (min <= 0) return false;
  if (max / min <= 1.15) return true;
  // A single step up or down that then stays put is a price change
  let changes = 0;
  for (let i = 1; i < amounts.length; i++) {
    if (Math.abs(amounts[i] - amounts[i - 1]) / amounts[i - 1] > 0.05) changes++;
  }
  return changes <= 1 && max / min <= 1.6;
}

/** Split a merchant's charges into price groups, e.g. two Google Play subscriptions */
function splitByAmount(txs: NormalizedTransaction[]): NormalizedTransaction[][] {
  const sorted = [...txs].sort((a, b) => a.amount - b.amount);
  const groups: NormalizedTransaction[][] = [];
  for (const tx of sorted) {
    const g = groups[groups.length - 1];
    if (g && tx.amount / g[0].amount <= 1.1) g.push(tx);
    else groups.push([tx]);
  }
  return groups.map((g) => g.sort((a, b) => a.date.localeCompare(b.date)));
}

/**
 * Finds recurring payments in a list of money-out transactions.
 * Everyday spending (food orders, rides, shopping) has changing amounts and
 * uneven gaps, so it is dropped instead of being suggested as a subscription.
 */
export function detectRecurringCandidates(
  transactions: NormalizedTransaction[],
  categories: Category[] = [],
  currency: string = 'INR'
): RecurringCandidate[] {
  if (transactions.length === 0) return [];

  const groups = clusterTransactionsBySimilarity(transactions);
  const candidates: RecurringCandidate[] = [];
  // Last day the statement covers, to judge one-off charges
  const statementEnd = transactions.reduce((max, t) => (t.date > max ? t.date : max), transactions[0].date);

  groups.forEach((group, merchantKey) => {
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));
    const brand = findBrand(sorted[0].rawDescription || sorted[0].cleanMerchant);
    const isSubBrand = brand?.subscription === true;
    // Food delivery, shopping and rides: only a near-identical amount repeating
    // on a steady cycle (e.g. a meal plan) counts. Two similar orders don't.
    const isEverydayBrand = brand?.subscription === false;
    const raw = `${sorted[0].rawDescription || ''} ${sorted[0].cleanMerchant}`;
    // Unknown merchant that looks like an EMI, rent, bill or a transfer to a person: skip it
    if (!brand && (NOT_A_SUBSCRIPTION.test(raw) || PERSON_TRANSFER.test(raw))) return;
    // Food delivery, shopping, rides, travel: everyday spending, never a subscription.
    // Their paid plans (Swiggy One, Zomato Gold, Amazon Prime) are separate brands.
    if (isEverydayBrand) return;
    // Unknown merchant with nothing that says "plan" or "online service": daily spending
    if (!brand && !SUBSCRIPTION_SIGNAL.test(raw)) return;

    const evaluate = (txs: NormalizedTransaction[], label: string, suffix?: string) => {
      const amounts = txs.map((t) => t.amount);
      const intervals: number[] = [];
      for (let i = 1; i < txs.length; i++) {
        intervals.push(differenceInDays(parseISO(txs[i].date), parseISO(txs[i - 1].date)));
      }
      // Same-day duplicates (a retried payment) shouldn't count as a cycle
      const gaps = intervals.filter((g) => g > 1);
      const match = matchCadence(gaps);
      const stable = amountsConsistent(amounts);

      let confidence: 'high' | 'medium' | 'low';
      let cycle: BillingCycle = 'monthly';
      let days = 30;

      if (txs.length === 1) {
        if (!isSubBrand) return false;
        confidence = 'medium';
        // Charged once and not again for over a month: not a monthly plan.
        // Most likely yearly (Amazon Prime ₹1,499, YouTube ₹1,290 and so on).
        const quietDays = differenceInDays(parseISO(statementEnd), parseISO(txs[0].date));
        if (quietDays > 35) {
          cycle = 'yearly';
          days = 365;
        }
      } else if (isEverydayBrand && (txs.length < 3 || !match?.regular || Math.max(...amounts) / Math.min(...amounts) > 1.03)) {
        return false;
      } else if (match && stable && !brand) {
        // Unknown merchant: needs 3+ same-price charges on a steady monthly or longer
        // cycle, and is shown unticked so only real subscriptions are pre-selected
        if (txs.length < 3 || !match.regular || match.cadence.days < 28) return false;
        cycle = match.cadence.cycle;
        days = match.cadence.days;
        confidence = 'low';
      } else if (match && stable) {
        cycle = match.cadence.cycle;
        days = match.cadence.days;
        confidence = isEverydayBrand ? 'low' : match.regular && (txs.length >= 3 || isSubBrand) ? 'high' : 'medium';
      } else if (isSubBrand && stable) {
        confidence = 'medium';
      } else if (isSubBrand) {
        confidence = 'low';
      } else {
        return false; // irregular, changing amounts: everyday spending
      }

      const first = txs[0];
      const last = txs[txs.length - 1];
      const latestAmount = last.amount;
      const name = suffix ? `${label} (${suffix})` : label;

      let valueRating: ValueRating = 'useful';
      if (/github|1password|bitwarden|proton|aws|airtel|jio|^vi$|act fibernet|google one|icloud/i.test(label)) {
        valueRating = 'essential';
      }

      candidates.push({
        id: `candidate-${merchantKey.replace(/[^a-z0-9]/g, '-')}-${suffix || 'all'}-${first.date}`,
        merchantName: name,
        amount: latestAmount,
        currency,
        billingCycle: cycle,
        frequencyDays: days,
        confidence,
        transactionCount: txs.length,
        firstDate: first.date,
        lastDate: last.date,
        estimatedNextRenewal: rollForwardRenewalDate(last.date, cycle, days),
        matchedTransactions: txs,
        suggestedCategoryId: suggestCategoryForMerchant(label, categories)?.id || null,
        valueRating,
        selected: confidence !== 'low',
      });
      return true;
    };

    const label = sorted[0].cleanMerchant;
    if (evaluate(sorted, label)) return;

    // The whole group didn't look recurring. Try each price group on its own
    // (two plans from the same store, or a ₹199 plan among random orders).
    // A price group pulled out of a mixed list needs 3+ charges, so two orders
    // that happen to cost about the same are not mistaken for a plan.
    const priceGroups = splitByAmount(sorted).filter((g) => g.length >= (isSubBrand ? 1 : 3));
    if (priceGroups.length === 0 || priceGroups.length === sorted.length) return;
    const multiple = priceGroups.length > 1;
    for (const g of priceGroups) {
      const priceLabel = multiple ? `${currency === 'INR' ? '₹' : ''}${Math.round(g[g.length - 1].amount)}` : undefined;
      evaluate(g, label, priceLabel);
    }
  });

  const weight = { high: 3, medium: 2, low: 1 };
  return candidates.sort((a, b) =>
    weight[b.confidence] !== weight[a.confidence] ? weight[b.confidence] - weight[a.confidence] : b.amount - a.amount
  );
}

/**
 * Matches category based on merchant name
 */
export function suggestCategoryForMerchant(merchantName: string, categories: Category[]): Category | null {
  const lower = merchantName.toLowerCase();

  // First match wins, so the more specific groups come first.
  const slugMap: [RegExp, string][] = [
    [/github|vercel|cursor|chatgpt|openai|claude|anthropic|perplexity|gemini|copilot|figma|canva|adobe|notion|linear|jetbrains|replit|framer|webflow/, 'software-dev'],
    [/aws|amazon web services|azure|supabase|digitalocean|hostinger|godaddy|namecheap|cloudflare|google one|google workspace|icloud|dropbox|onedrive|backblaze/, 'infra-cloud'],
    [/slack|zoom|microsoft 365|office 365|grammarly|1password|bitwarden|lastpass|proton|nordvpn|expressvpn|surfshark|todoist|evernote|calendly/, 'productivity'],
    [/coursera|udemy|unacademy|byju|vedantu|physics ?wallah|\bpw\b|skillshare|masterclass|brilliant\.org|duolingo|khan academy|edx|testbook|adda247|upgrad|scaler|leetcode|codecademy|datacamp|linkedin learning|chegg/, 'education-learning'],
    [/netflix|jiohotstar|hotstar|disney|prime video|amazon prime|zee5|sonyliv|sony liv|voot|mxplayer|\baha\b|sun ?nxt|hoichoi|altbalaji|\beros\b|youtube|twitch|crunchyroll|mubi|apple tv|\bhbo\b|\bmax\b|tata play|dish ?tv|airtel dth|d2h|spotify|jiosaavn|gaana|wynk|apple music|amazon music|xbox|playstation|psn|steam|nintendo|ea play|ubisoft|epic games|google play|bgmi|discord nitro/, 'entertainment-games'],
    [/kindle|audible|pocket fm|kuku fm|storytel|scribd|medium|substack|times of india|toi\+|the hindu|indian express|hindustan times|economic times|\bet prime\b|\bmint\b|magzter|readly|nytimes|new york times|washington post|economist|bloomberg/, 'media-reading'],
    [/cult\.?fit|cultfit|gym|fitness|healthifyme|fittr|strava|headspace|\bcalm\b|practo|pharmeasy|1mg|netmeds|apollo 24|insurance|health/, 'health-routine'],
    [/swiggy|zomato|blinkit|zepto|instamart|bigbasket|dunzo|eatsure|box8|domino|eazydiner|dineout/, 'food-delivery'],
    [/amazon(?! web| prime| music)|flipkart|myntra|ajio|nykaa|meesho|tata ?neu|tata cliq|croma|reliance digital|lenskart|urban company|first ?cry|times prime/, 'shopping-commerce'],
    [/\buber\b|\bola\b|rapido|irctc|makemytrip|goibibo|cleartrip|ixigo|redbus|yatra|airbnb|booking\.com|indigo|air india|vistara|akasa|fastag|\bmetro\b/, 'travel-transport'],
    [/zerodha|groww|upstox|angel one|\bkite\b|smallcase|cred\b|paytm money|indmoney|et money|kuvera|\bsip\b|mutual fund|\blic\b|policybazaar|acko|digit insurance|loan|\bemi\b|credit card fee|annual fee|bank charge/, 'finance-money'],
    [/airtel|jio|\bvi\b|vodafone|\bidea\b|bsnl|act fibernet|hathway|excitel|tata sky|broadband|electricity|bescom|tneb|msedcl|water bill|\bgas\b|piped gas|indane|bharat gas|linkedin/, 'utilities-sync'],
    [/school|tuition|daycare|creche|society maintenance|maintenance|\brent\b|housekeeping|\bmaid\b|nanny|\bpet\b/, 'family-home'],
  ];

  for (const [re, slug] of slugMap) {
    if (re.test(lower)) {
      const matched = categories.find((c) => c.slug === slug || c.slug_aliases?.includes(slug));
      if (matched) return matched;
    }
  }
  return null;
}
