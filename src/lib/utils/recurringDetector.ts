import {
  BillingCycle,
  Category,
  NormalizedTransaction,
  RecurringCandidate,
  ValueRating,
} from '../types';
import { addDays, addMonths, addYears, differenceInDays, isBefore, parseISO, format } from 'date-fns';
import { clusterTransactionsBySimilarity } from './merchantMatcher';

const KNOWN_SUBSCRIPTION_BRANDS = [
  'spotify',
  'netflix',
  'github',
  'notion',
  'linear',
  'figma',
  'openai',
  'chatgpt',
  'claude',
  'cursor',
  'vercel',
  'supabase',
  'aws',
  'amazon',
  'youtube',
  'google',
  'apple',
  'icloud',
  'disney',
  'hulu',
  'max (hbo)',
  'adobe',
  'slack',
  'zoom',
  'loom',
  'dropbox',
  'nytimes',
  'medium',
  'substack',
  'strava',
  'planet fitness',
  'equinox',
  'whoop',
  'oura',
  'audible',
  'playstation',
  'xbox',
  '1password',
  'bitwarden',
  'proton',
];

/**
 * Detects recurring subscription candidates using fuzzy descriptor clustering and interval analysis
 */
export function detectRecurringCandidates(
  transactions: NormalizedTransaction[],
  categories: Category[] = [],
  currency: string = 'USD'
): RecurringCandidate[] {
  if (transactions.length === 0) return [];

  // Group transactions using intelligent fuzzy descriptor clustering
  const merchantGroups = clusterTransactionsBySimilarity(transactions);

  const candidates: RecurringCandidate[] = [];

  merchantGroups.forEach((group, merchantKey) => {
    // Sort transactions chronologically
    const sortedGroup = [...group].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const isRecognizedBrand = KNOWN_SUBSCRIPTION_BRANDS.some((brand) =>
      merchantKey.includes(brand)
    );

    // If only 1 transaction and not a recognized recurring brand, ignore one-off charge
    if (sortedGroup.length < 2 && !isRecognizedBrand) {
      return;
    }

    const firstTx = sortedGroup[0];
    const lastTx = sortedGroup[sortedGroup.length - 1];
    const amounts = sortedGroup.map((t) => t.amount);
    const avgAmount = Math.round((amounts.reduce((a, b) => a + b, 0) / amounts.length) * 100) / 100;
    const latestAmount = lastTx.amount;

    // Determine Cadence & Intervals
    let billingCycle: BillingCycle = 'monthly';
    let frequencyDays = 30;
    let confidence: 'high' | 'medium' | 'low' = 'low';

    if (sortedGroup.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < sortedGroup.length; i++) {
        const diff = differenceInDays(
          parseISO(sortedGroup[i].date),
          parseISO(sortedGroup[i - 1].date)
        );
        intervals.push(diff);
      }

      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

      if (avgInterval >= 25 && avgInterval <= 35) {
        billingCycle = 'monthly';
        frequencyDays = 30;
        confidence = intervals.every((inv) => Math.abs(inv - 30) <= 5) ? 'high' : 'medium';
      } else if (avgInterval >= 80 && avgInterval <= 100) {
        billingCycle = 'quarterly';
        frequencyDays = 90;
        confidence = 'medium';
      } else if (avgInterval >= 340 && avgInterval <= 380) {
        billingCycle = 'yearly';
        frequencyDays = 365;
        confidence = 'high';
      } else if (avgInterval >= 6 && avgInterval <= 8) {
        // Weekly
        billingCycle = 'custom';
        frequencyDays = 7;
        confidence = 'medium';
      } else {
        billingCycle = 'monthly';
        frequencyDays = 30;
        confidence = 'low';
      }

      // Check amount consistency
      const maxAmountDiff = Math.max(...amounts) - Math.min(...amounts);
      if (maxAmountDiff === 0 && confidence !== 'low') {
        confidence = 'high';
      }
    } else {
      // Single transaction of known brand
      billingCycle = 'monthly';
      frequencyDays = 30;
      confidence = 'medium';
    }

    // Estimate Next Renewal Date
    const estimatedNextRenewal = calculateEstimatedNextRenewal(lastTx.date, billingCycle, frequencyDays);

    // Suggest Category
    const suggestedCategory = suggestCategoryForMerchant(sortedGroup[0].cleanMerchant, categories);

    // Initial Value Rating Guess
    let valueRating: ValueRating = 'useful';
    if (['github', '1password', 'bitwarden', 'proton', 'aws'].some((b) => merchantKey.includes(b))) {
      valueRating = 'essential';
    }

    candidates.push({
      id: `candidate-${merchantKey.replace(/[^a-z0-9]/g, '-')}-${Date.now()}`,
      merchantName: sortedGroup[0].cleanMerchant,
      amount: latestAmount || avgAmount,
      currency,
      billingCycle,
      frequencyDays,
      confidence,
      transactionCount: sortedGroup.length,
      firstDate: firstTx.date,
      lastDate: lastTx.date,
      estimatedNextRenewal,
      matchedTransactions: sortedGroup,
      suggestedCategoryId: suggestedCategory?.id || null,
      valueRating,
      selected: confidence === 'high' || confidence === 'medium',
    });
  });

  // Sort candidates by confidence (high -> medium -> low), then by amount descending
  return candidates.sort((a, b) => {
    const confWeight = { high: 3, medium: 2, low: 1 };
    if (confWeight[b.confidence] !== confWeight[a.confidence]) {
      return confWeight[b.confidence] - confWeight[a.confidence];
    }
    return b.amount - a.amount;
  });
}

/**
 * Calculates estimated next renewal date projected forward into the future
 */
function calculateEstimatedNextRenewal(
  lastDateStr: string,
  billingCycle: BillingCycle,
  customDays = 30
): string {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let nextDate = parseISO(lastDateStr);

    // Roll forward until it lands in the future
    while (isBefore(nextDate, today)) {
      if (billingCycle === 'monthly') {
        nextDate = addMonths(nextDate, 1);
      } else if (billingCycle === 'quarterly') {
        nextDate = addMonths(nextDate, 3);
      } else if (billingCycle === 'yearly') {
        nextDate = addYears(nextDate, 1);
      } else {
        nextDate = addDays(nextDate, customDays || 30);
      }
    }

    return format(nextDate, 'yyyy-MM-dd');
  } catch {
    return format(addMonths(new Date(), 1), 'yyyy-MM-dd');
  }
}

/**
 * Matches category based on merchant name
 */
export function suggestCategoryForMerchant(
  merchantName: string,
  categories: Category[]
): Category | null {
  const lower = merchantName.toLowerCase();

  const slugMap: Record<string, string> = {
    // Software & Dev
    github: 'software-dev',
    vercel: 'software-dev',
    cursor: 'software-dev',
    linear: 'software-dev',
    openai: 'software-dev',
    claude: 'software-dev',
    chatgpt: 'software-dev',
    figma: 'software-dev',
    // Infrastructure & Cloud
    aws: 'infra-cloud',
    supabase: 'infra-cloud',
    google: 'infra-cloud',
    cloudflare: 'infra-cloud',
    digitalocean: 'infra-cloud',
    // Productivity & Notes
    notion: 'productivity',
    slack: 'productivity',
    zoom: 'productivity',
    loom: 'productivity',
    dropbox: 'productivity',
    // Media & Reading
    spotify: 'media-reading',
    netflix: 'media-reading',
    youtube: 'media-reading',
    disney: 'media-reading',
    hulu: 'media-reading',
    nytimes: 'media-reading',
    medium: 'media-reading',
    substack: 'media-reading',
    audible: 'media-reading',
    // Health & Routine
    gym: 'health-routine',
    fitness: 'health-routine',
    strava: 'health-routine',
    whoop: 'health-routine',
    oura: 'health-routine',
    // Utilities & Sync
    '1password': 'utilities-sync',
    bitwarden: 'utilities-sync',
    proton: 'utilities-sync',
    icloud: 'utilities-sync',
  };

  for (const [key, slug] of Object.entries(slugMap)) {
    if (lower.includes(key)) {
      const matched = categories.find((c) => c.slug === slug);
      if (matched) return matched;
    }
  }

  return null;
}
