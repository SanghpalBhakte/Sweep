import { normalizeMonthlyAmount } from '../utils/currency';
import type { BillingCycle } from '../types';

export interface PresetTier {
  name: string;
  amount: number;
  cycle: 'monthly' | 'quarterly' | 'yearly';
}

export interface PopularService {
  name: string;
  /** Other names people type, e.g. "hotstar" for JioHotstar */
  aliases?: string[];
  /** India plans in INR. When set, the form lets you pick one. */
  tiers?: PresetTier[];
  defaultAmount?: number;
  currency?: string;
  billingCycle?: 'monthly' | 'quarterly' | 'yearly';
  categorySlug?: string;
  cancelUrl?: string;
  description?: string;
}

/** Shown next to preset prices. Update when the prices below are checked again. */
export const PRESET_PRICES_NOTE = 'Prices checked Oct 2026 and may change. Match it to your bill.';

/** Tier name for student plans (college ID needed). studentPlanHint looks for it. */
export const STUDENT_TIER = 'Student';

const t = (name: string, amount: number, cycle: PresetTier['cycle']): PresetTier => ({ name, amount, cycle });

// India first: these show up before the global ones in search.
const INDIA_SERVICES: PopularService[] = [
  {
    name: 'Netflix',
    currency: 'INR',
    tiers: [t('Mobile', 149, 'monthly'), t('Basic', 199, 'monthly'), t('Standard', 499, 'monthly'), t('Premium', 649, 'monthly')],
    categorySlug: 'entertainment-games',
    cancelUrl: 'https://www.netflix.com/cancelplan',
    description: 'Movies and shows',
  },
  {
    name: 'JioHotstar',
    aliases: ['hotstar', 'disney', 'jiocinema'],
    currency: 'INR',
    tiers: [
      t('Mobile', 79, 'monthly'),
      t('Mobile', 149, 'quarterly'),
      t('Mobile', 499, 'yearly'),
      t('Super', 149, 'monthly'),
      t('Super', 349, 'quarterly'),
      t('Super', 1099, 'yearly'),
      t('Premium', 299, 'monthly'),
      t('Premium', 699, 'quarterly'),
      t('Premium', 2199, 'yearly'),
    ],
    categorySlug: 'entertainment-games',
    cancelUrl: 'https://www.hotstar.com/in/mypage',
    description: 'Cricket, movies and shows',
  },
  {
    name: 'Spotify',
    currency: 'INR',
    tiers: [
      t('Individual', 139, 'monthly'),
      t('Duo', 179, 'monthly'),
      t('Family', 229, 'monthly'),
      t(STUDENT_TIER, 69, 'monthly'),
    ],
    categorySlug: 'media-reading',
    cancelUrl: 'https://www.spotify.com/in-en/account/subscription/',
    description: 'Music streaming',
  },
  {
    name: 'YouTube Premium',
    aliases: ['youtube', 'yt premium', 'youtube music'],
    currency: 'INR',
    tiers: [
      t('Individual', 149, 'monthly'),
      t('Individual', 1490, 'yearly'),
      t('Family', 299, 'monthly'),
      t(STUDENT_TIER, 89, 'monthly'),
    ],
    categorySlug: 'media-reading',
    cancelUrl: 'https://www.youtube.com/paid_memberships',
    description: 'No ads, music, downloads',
  },
  {
    name: 'Amazon Prime',
    aliases: ['prime', 'prime video'],
    currency: 'INR',
    tiers: [
      t('Prime', 299, 'monthly'),
      t('Prime', 599, 'quarterly'),
      t('Prime', 1499, 'yearly'),
      t('Prime Lite', 799, 'yearly'),
      t('Shopping Edition', 399, 'yearly'),
    ],
    categorySlug: 'shopping-commerce',
    cancelUrl: 'https://www.amazon.in/mc',
    description: 'Delivery and Prime Video',
  },
  {
    name: 'Google One',
    aliases: ['google drive', 'gemini'],
    currency: 'INR',
    tiers: [
      t('Lite 30 GB', 59, 'monthly'),
      t('100 GB', 130, 'monthly'),
      t('100 GB', 1300, 'yearly'),
      t('2 TB', 650, 'monthly'),
      t('2 TB', 6500, 'yearly'),
      t('AI Pro 2 TB', 1950, 'monthly'),
    ],
    categorySlug: 'infra-cloud',
    cancelUrl: 'https://one.google.com/settings',
    description: 'Google storage',
  },
  {
    name: 'ChatGPT',
    aliases: ['chatgpt plus', 'openai'],
    currency: 'INR',
    tiers: [t('Go', 399, 'monthly'), t('Plus', 1999, 'monthly')],
    categorySlug: 'software-dev',
    cancelUrl: 'https://chatgpt.com/#settings/Subscription',
    description: 'OpenAI subscription',
  },
  {
    name: 'Apple Music',
    currency: 'INR',
    tiers: [t('Individual', 139, 'monthly'), t('Family', 179, 'monthly'), t(STUDENT_TIER, 69, 'monthly')],
    categorySlug: 'media-reading',
    cancelUrl: 'https://apps.apple.com/account/subscriptions',
    description: 'Music streaming',
  },
  {
    name: 'Zee5',
    aliases: ['zee 5'],
    currency: 'INR',
    tiers: [t('Mobile', 649, 'yearly'), t('Premium HD', 299, 'quarterly'), t('Premium HD', 999, 'yearly')],
    categorySlug: 'entertainment-games',
    cancelUrl: 'https://www.zee5.com/myaccount/subscription',
    description: 'Shows and movies',
  },
  {
    name: 'SonyLIV',
    aliases: ['sony liv'],
    currency: 'INR',
    tiers: [t('Mobile', 699, 'yearly'), t('Premium', 399, 'monthly'), t('Premium', 1499, 'yearly')],
    categorySlug: 'entertainment-games',
    cancelUrl: 'https://www.sonyliv.com/myaccount',
    description: 'Sports, shows and movies',
  },
];

// Global tools. Prices are USD.
const GLOBAL_SERVICES: PopularService[] = [
  {
    name: 'Cursor Pro',
    defaultAmount: 20,
    billingCycle: 'monthly',
    categorySlug: 'software-dev',
    cancelUrl: 'https://cursor.com/settings',
    description: 'AI code editor',
  },
  {
    name: 'GitHub Copilot',
    defaultAmount: 10,
    billingCycle: 'monthly',
    categorySlug: 'software-dev',
    cancelUrl: 'https://github.com/settings/billing',
    description: 'AI pair programmer',
  },
  {
    name: 'Claude Pro',
    defaultAmount: 20,
    billingCycle: 'monthly',
    categorySlug: 'software-dev',
    cancelUrl: 'https://claude.ai/settings/billing',
    description: 'Anthropic AI assistant',
  },
  {
    name: 'iCloud+ 50GB',
    defaultAmount: 0.99,
    billingCycle: 'monthly',
    categorySlug: 'infra-cloud',
    cancelUrl: 'https://appleid.apple.com',
    description: 'Apple cloud storage',
  },
  {
    name: 'iCloud+ 200GB',
    defaultAmount: 2.99,
    billingCycle: 'monthly',
    categorySlug: 'infra-cloud',
    cancelUrl: 'https://appleid.apple.com',
    description: 'Apple cloud storage',
  },
  {
    name: 'Dropbox Plus',
    defaultAmount: 11.99,
    billingCycle: 'monthly',
    categorySlug: 'infra-cloud',
    cancelUrl: 'https://www.dropbox.com/account/plan',
    description: 'Cloud file sync',
  },
  {
    name: '1Password Individual',
    defaultAmount: 2.99,
    billingCycle: 'monthly',
    categorySlug: 'utilities-sync',
    cancelUrl: 'https://my.1password.com/profile',
    description: 'Password manager',
  },
  {
    name: 'Bitwarden Premium',
    defaultAmount: 10.0,
    billingCycle: 'yearly',
    categorySlug: 'utilities-sync',
    cancelUrl: 'https://vault.bitwarden.com/#/settings/subscription',
    description: 'Password manager',
  },
  {
    name: 'Fastmail Standard',
    defaultAmount: 5.0,
    billingCycle: 'monthly',
    categorySlug: 'utilities-sync',
    cancelUrl: 'https://www.fastmail.com/settings/billing',
    description: 'Private email',
  },
  {
    name: 'Proton Unlimited',
    defaultAmount: 9.99,
    billingCycle: 'monthly',
    categorySlug: 'utilities-sync',
    cancelUrl: 'https://account.proton.me/u/0/mail/subscription',
    description: 'Encrypted privacy suite',
  },
  {
    name: 'Notion Plus',
    defaultAmount: 10.0,
    billingCycle: 'monthly',
    categorySlug: 'productivity',
    cancelUrl: 'https://www.notion.so/settings',
    description: 'Workspace & notes',
  },
  {
    name: 'Figma Professional',
    defaultAmount: 15.0,
    billingCycle: 'monthly',
    categorySlug: 'software-dev',
    cancelUrl: 'https://www.figma.com/settings',
    description: 'Interface design tool',
  },
  {
    name: 'Vercel Pro',
    defaultAmount: 20.0,
    billingCycle: 'monthly',
    categorySlug: 'infra-cloud',
    cancelUrl: 'https://vercel.com/dashboard/billing',
    description: 'Frontend cloud platform',
  },
  {
    name: 'Linear Standard',
    defaultAmount: 10.0,
    billingCycle: 'monthly',
    categorySlug: 'productivity',
    cancelUrl: 'https://linear.app/settings/billing',
    description: 'Issue & project tracking',
  },
  {
    name: 'Midjourney Basic',
    defaultAmount: 10.0,
    billingCycle: 'monthly',
    categorySlug: 'media-reading',
    cancelUrl: 'https://www.midjourney.com/account',
    description: 'Generative AI imagery',
  },
  {
    name: 'Superhuman',
    defaultAmount: 30.0,
    billingCycle: 'monthly',
    categorySlug: 'productivity',
    cancelUrl: 'https://mail.superhuman.com',
    description: 'Fast email client',
  },
  {
    name: 'Gym Membership',
    defaultAmount: 50.0,
    billingCycle: 'monthly',
    categorySlug: 'health-routine',
    description: 'Health & fitness',
  },
  {
    name: 'Headspace',
    defaultAmount: 12.99,
    billingCycle: 'monthly',
    categorySlug: 'health-routine',
    cancelUrl: 'https://www.headspace.com/subscription',
    description: 'Mindfulness & meditation',
  },
  {
    name: 'New York Times',
    defaultAmount: 4.0,
    billingCycle: 'monthly',
    categorySlug: 'media-reading',
    cancelUrl: 'https://www.nytimes.com/subscription',
    description: 'News & journalism',
  },
];

export const POPULAR_SERVICES: PopularService[] = [...INDIA_SERVICES, ...GLOBAL_SERVICES];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const matchExact = (n: string) =>
  POPULAR_SERVICES.find((s) => norm(s.name) === n || s.aliases?.some((a) => norm(a) === n));

/**
 * The preset whose name matches (ignoring case and spaces), if any. Also matches names
 * like "Spotify Premium" or "YouTube Premium (Trial)" by dropping the extra words.
 */
export function findPreset(name: string): PopularService | undefined {
  const n = norm(name);
  if (!n) return undefined;
  const exact = matchExact(n);
  if (exact) return exact;
  const trimmed = norm(
    name.replace(/\(.*?\)/g, ' ').replace(/\b(premium|subscription|plan|membership|trial)\b/gi, ' ')
  );
  return trimmed && trimmed !== n ? matchExact(trimmed) : undefined;
}

/** Presets for the search box: name, alias or description contains the query. */
export function searchPresets(query: string, limit = 5): PopularService[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const nq = norm(q);
  return POPULAR_SERVICES.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      (nq && norm(s.name).includes(nq)) ||
      s.aliases?.some((a) => norm(a).includes(nq)) ||
      s.description?.toLowerCase().includes(q)
  ).slice(0, limit);
}

/**
 * When a sub matches a preset with a student plan and costs more than it, the student
 * price and what switching saves in a year. Null when already on it, on a shared plan, or not in INR.
 */
export function studentPlanHint(sub: {
  name: string;
  amount: number;
  currency: string;
  billing_cycle: BillingCycle;
  custom_interval_days?: number | null;
  description?: string | null;
}): { tier: PresetTier; yearlySaving: number } | null {
  const preset = findPreset(sub.name);
  const tier = preset?.tiers?.find((x) => x.name === STUDENT_TIER);
  if (!tier || sub.currency.toUpperCase() !== 'INR' || !(sub.amount > 0)) return null;
  // Family and Duo plans are shared, so a one person student plan is not a like for like swap
  const sharedTier = preset?.tiers?.some(
    (x) => /family|duo/i.test(x.name) && x.amount === sub.amount && x.cycle === sub.billing_cycle
  );
  if (sharedTier || /family|duo|student/i.test(sub.description ?? '')) return null;
  const monthly = normalizeMonthlyAmount(sub.amount, sub.billing_cycle, sub.custom_interval_days ?? undefined);
  const studentMonthly = normalizeMonthlyAmount(tier.amount, tier.cycle);
  const yearlySaving = Math.round((monthly - studentMonthly) * 12);
  return yearlySaving > 0 ? { tier, yearlySaving } : null;
}
