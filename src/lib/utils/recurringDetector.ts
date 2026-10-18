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
      } else if (match && stable) {
        cycle = match.cadence.cycle;
        days = match.cadence.days;
        confidence = match.regular && (txs.length >= 3 || isSubBrand) ? 'high' : 'medium';
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

  const slugMap: [RegExp, string][] = [
    [/github|vercel|cursor|chatgpt|claude|figma|canva|adobe|notion|linear/, 'software-dev'],
    [/aws|supabase|digitalocean|hostinger|godaddy|google one|icloud|dropbox/, 'infra-cloud'],
    [/slack|zoom|microsoft 365|grammarly|1password|bitwarden|proton|nordvpn/, 'productivity'],
    [/netflix|spotify|youtube|jiohotstar|amazon prime|zee5|sonyliv|jiosaavn|gaana|audible|kindle|apple|medium|substack|disney|max|tata play|google play|xbox|playstation/, 'media-reading'],
    [/cult\.fit|gym|fitness|duolingo/, 'health-routine'],
    [/airtel|jio|^vi$|act fibernet|times prime|swiggy one|zomato gold|linkedin/, 'utilities-sync'],
  ];

  for (const [re, slug] of slugMap) {
    if (re.test(lower)) {
      const matched = categories.find((c) => c.slug === slug || c.slug_aliases?.includes(slug));
      if (matched) return matched;
    }
  }
  return null;
}
