// Turns raw statement narrations into a clean merchant name, and groups
// transactions from the same merchant. Knows Indian formats (UPI, NACH,
// e-mandate / standing instructions, POS, IMPS) and card descriptors.

import { NormalizedTransaction } from '../types';

export interface NormalizedDescriptorResult {
  raw: string;
  normalized: string;
  canonical: string;
  tokens: string[];
  /** True when the merchant is a known subscription service */
  isSubscriptionBrand?: boolean;
}

interface Brand {
  pattern: RegExp; // tested against the squashed lowercase narration (letters+digits only)
  name: string;
  subscription: boolean;
}

// Order matters: specific names before generic ones (JioHotstar before Jio,
// Amazon Prime before Amazon, Google One before Google).
const BRANDS: Brand[] = [
  { pattern: /jiohotstar|disneyhotstar|hotstar/, name: 'JioHotstar', subscription: true },
  { pattern: /netflix/, name: 'Netflix', subscription: true },
  { pattern: /spotify/, name: 'Spotify', subscription: true },
  { pattern: /youtube/, name: 'YouTube Premium', subscription: true },
  { pattern: /primevideo|amazonprime|amznprime|primemembership/, name: 'Amazon Prime', subscription: true },
  { pattern: /googleone|googlestorage|googleonestorage/, name: 'Google One', subscription: true },
  { pattern: /googleplay|playstore/, name: 'Google Play', subscription: true },
  { pattern: /icloud/, name: 'iCloud+', subscription: true },
  { pattern: /applecombill|appleservices|itunes|applemusic|appletv/, name: 'Apple', subscription: true },
  { pattern: /zee5/, name: 'ZEE5', subscription: true },
  { pattern: /sonyliv/, name: 'SonyLIV', subscription: true },
  { pattern: /jiosaavn/, name: 'JioSaavn', subscription: true },
  { pattern: /gaana/, name: 'Gaana', subscription: true },
  { pattern: /audible/, name: 'Audible', subscription: true },
  { pattern: /kindleunlimited/, name: 'Kindle Unlimited', subscription: true },
  { pattern: /linkedin/, name: 'LinkedIn Premium', subscription: true },
  { pattern: /chatgpt|openai/, name: 'ChatGPT', subscription: true },
  { pattern: /anthropic|claudeai/, name: 'Claude', subscription: true },
  { pattern: /cursor(ai|sh)?/, name: 'Cursor', subscription: true },
  { pattern: /github/, name: 'GitHub', subscription: true },
  { pattern: /notion/, name: 'Notion', subscription: true },
  { pattern: /figma/, name: 'Figma', subscription: true },
  { pattern: /canva(?!s)/, name: 'Canva', subscription: true },
  { pattern: /adobe/, name: 'Adobe', subscription: true },
  { pattern: /microsoft365|msft365|office365/, name: 'Microsoft 365', subscription: true },
  { pattern: /xboxgamepass|xbox/, name: 'Xbox Game Pass', subscription: true },
  { pattern: /playstation|sonyinteractive|psplus/, name: 'PlayStation Plus', subscription: true },
  { pattern: /duolingo/, name: 'Duolingo', subscription: true },
  { pattern: /grammarly/, name: 'Grammarly', subscription: true },
  { pattern: /dropbox/, name: 'Dropbox', subscription: true },
  { pattern: /1password|onepassword/, name: '1Password', subscription: true },
  { pattern: /bitwarden/, name: 'Bitwarden', subscription: true },
  { pattern: /protonmail|protonag|proton(vpn|ch)/, name: 'Proton', subscription: true },
  { pattern: /nordvpn/, name: 'NordVPN', subscription: true },
  { pattern: /cultfit|curefit/, name: 'cult.fit', subscription: true },
  { pattern: /timesprime/, name: 'Times Prime', subscription: true },
  { pattern: /swiggyone/, name: 'Swiggy One', subscription: true },
  { pattern: /zomatogold/, name: 'Zomato Gold', subscription: true },
  { pattern: /tataplay|tatasky/, name: 'Tata Play', subscription: true },
  { pattern: /actfibernet|atriaconvergence/, name: 'ACT Fibernet', subscription: true },
  { pattern: /airtel/, name: 'Airtel', subscription: true },
  { pattern: /reliancejio|jioprepaid|jiopostpaid|jiofiber|^jio|jiomobility/, name: 'Jio', subscription: true },
  { pattern: /vodafoneidea|vodafone|myvi/, name: 'Vi', subscription: true },
  { pattern: /medium/, name: 'Medium', subscription: true },
  { pattern: /substack/, name: 'Substack', subscription: true },
  { pattern: /vercel/, name: 'Vercel', subscription: true },
  { pattern: /supabase/, name: 'Supabase', subscription: true },
  { pattern: /awsamazon|amazonwebservices|awsemea|awsindia/, name: 'AWS', subscription: true },
  { pattern: /digitalocean/, name: 'DigitalOcean', subscription: true },
  { pattern: /hostinger/, name: 'Hostinger', subscription: true },
  { pattern: /godaddy/, name: 'GoDaddy', subscription: true },
  { pattern: /zoomus|zoomvideo|zoominfo/, name: 'Zoom', subscription: true },
  { pattern: /slack/, name: 'Slack', subscription: true },
  { pattern: /hbomax|maxcom/, name: 'Max', subscription: true },
  { pattern: /disneyplus/, name: 'Disney+', subscription: true },
  // Everyday merchants: named nicely, but need a real repeating pattern to count
  { pattern: /swiggy|bundltechnologies/, name: 'Swiggy', subscription: false },
  { pattern: /zomato/, name: 'Zomato', subscription: false },
  { pattern: /blinkit|grofers/, name: 'Blinkit', subscription: false },
  { pattern: /zepto|kiranakart/, name: 'Zepto', subscription: false },
  { pattern: /bigbasket|supermarketgrocery/, name: 'BigBasket', subscription: false },
  { pattern: /flipkart/, name: 'Flipkart', subscription: false },
  { pattern: /myntra/, name: 'Myntra', subscription: false },
  { pattern: /amazon|amzn/, name: 'Amazon', subscription: false },
  { pattern: /uber/, name: 'Uber', subscription: false },
  { pattern: /olacabs|anitechnologies/, name: 'Ola', subscription: false },
  { pattern: /rapido|roppen/, name: 'Rapido', subscription: false },
  { pattern: /irctc/, name: 'IRCTC', subscription: false },
  { pattern: /bookmyshow|bigtreeentertainment/, name: 'BookMyShow', subscription: false },
];

// Words and codes that carry no merchant meaning in Indian narrations
const NOISE_WORDS = new Set([
  'upi', 'dr', 'cr', 'p2m', 'p2a', 'p2p', 'nach', 'ach', 'ecs', 'tp', 'mandate', 'emandate', 'si', 'me', 'dc',
  'pos', 'ecom', 'vps', 'ips', 'neft', 'imps', 'rtgs', 'mmt', 'inb', 'bil', 'billpay', 'onl', 'int', 'debit',
  'credit', 'card', 'purchase', 'payment', 'payments', 'paid', 'pay', 'to', 'from', 'by', 'via', 'for', 'ref',
  'refno', 'txn', 'trf', 'transfer', 'autopay', 'auto', 'recurring', 'charge', 'charges', 'collect', 'request',
  'india', 'in', 'ind', 'pvt', 'ltd', 'private', 'limited', 'llp', 'inc', 'com', 'www', 'the', 'and', 'of',
  'online', 'services', 'service', 'bill', 'na', 'nil', 'others', 'other', 'sent', 'using', 'mumbai', 'bangalore',
  'bengaluru', 'delhi', 'new', 'gurgaon', 'gurugram', 'noida', 'pune', 'chennai', 'hyderabad', 'kolkata',
  'ahmedabad', 'singapore', 'dublin', 'irl', 'usa', 'us', 'gb', 'note', 'yesb', 'hdfc', 'icic', 'sbin', 'utib',
  'kkbk', 'paytm', 'ptys', 'ybl', 'okaxis', 'oksbi', 'okhdfcbank', 'okicici', 'axl', 'ibl', 'apl', 'ptsbi',
  'yes', 'bank', 'icici', 'axis', 'kotak', 'sbi', 'idfc', 'indusind', 'rbl', 'federal', 'bharat', 'state',
  'airtelpaymentsbank', 'phonepe', 'gpay', 'googlepay', 'bhim',
]);

const IFSC = /^[a-z]{4}0[a-z0-9]{6}$/i;

/** Pull the payee out of a UPI / NACH / mandate / POS narration. */
function extractPayee(raw: string): string {
  let s = raw.normalize('NFKC');

  // VPAs: keep the handle as a hint ("spotify@yes" -> "spotify"), drop the bank part
  // (no '-' in the handle, or it would eat the payee name before it)
  s = s.replace(/([a-z0-9._]+)@[a-z0-9.]+/gi, '$1');
  // Masked card numbers and long reference numbers
  s = s.replace(/\b[0-9x*]{4,}x+[0-9x*]*\b/gi, ' ').replace(/\b\d{5,}\b/g, ' ');
  // Web addresses
  s = s.replace(/\b(https?:\/\/)?(www\.)?([a-z0-9-]+)\.(com|in|io|net|org|co|app|me|tv)(\/\S*)?\b/gi, ' $3 ');

  const parts = s
    .split(/[\/\-|:,*#_\\]+|\s{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const meaningful = parts
    .map((p) => {
      const words = p
        .toLowerCase()
        .replace(/[^a-z0-9& ]/g, ' ')
        .split(/\s+/)
        .filter((w) => w && !NOISE_WORDS.has(w) && !/^\d+$/.test(w) && !IFSC.test(w) && w.length > 1);
      return words.join(' ');
    })
    .filter((p) => p.length >= 3);

  return meaningful[0] || '';
}

function titleCase(s: string): string {
  return s
    .split(' ')
    .filter(Boolean)
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function findBrand(raw: string): Brand | null {
  // Drop the bank part of UPI IDs first: "9876543210@airtel" is a person on
  // Airtel Payments Bank, not an Airtel bill. "spotify@yes" keeps "spotify".
  const squashed = raw
    .toLowerCase()
    .replace(/@[a-z0-9.]+/g, ' ')
    .replace(/[^a-z0-9]/g, '');
  for (const b of BRANDS) {
    if (b.pattern.test(squashed)) return b;
  }
  return null;
}

/**
 * 1. Deterministic normalization pipeline
 */
export function normalizeMerchantDescriptor(rawDesc: string): NormalizedDescriptorResult {
  if (!rawDesc || typeof rawDesc !== 'string') {
    return { raw: '', normalized: '', canonical: 'Unknown', tokens: [] };
  }
  const raw = rawDesc.trim();
  const brand = findBrand(raw);
  const payee = extractPayee(raw);

  const normalized = (brand ? brand.name.toLowerCase() : payee) || raw.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = normalized.split(' ').filter((t) => t.length > 1);

  const canonical = brand ? brand.name : payee ? titleCase(payee) : raw.slice(0, 32);

  return { raw, normalized, canonical, tokens, isSubscriptionBrand: brand?.subscription ?? false };
}

/**
 * 2. Levenshtein distance
 */
export function calculateLevenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * 3. Similarity score between two merchant strings (0..1)
 */
export function calculateMerchantSimilarity(strA: string, strB: string): number {
  const normA = normalizeMerchantDescriptor(strA);
  const normB = normalizeMerchantDescriptor(strB);

  if (normA.canonical && normA.canonical.toLowerCase() === normB.canonical.toLowerCase()) return 1.0;
  if (normA.normalized && normA.normalized === normB.normalized) return 1.0;

  const setA = new Set(normA.tokens);
  const setB = new Set(normB.tokens);
  if (setA.size === 0 || setB.size === 0) return 0;

  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  const jaccard = intersection / union;

  const maxLen = Math.max(normA.normalized.length, normB.normalized.length);
  const lev = maxLen > 0 ? 1 - calculateLevenshteinDistance(normA.normalized, normB.normalized) / maxLen : 0;

  return Math.round((jaccard * 0.55 + lev * 0.45) * 100) / 100;
}

/**
 * 4. Group transactions by merchant
 */
export function clusterTransactionsBySimilarity(
  transactions: NormalizedTransaction[]
): Map<string, NormalizedTransaction[]> {
  const clusters: { key: string; name: string; normalized: string; transactions: NormalizedTransaction[] }[] = [];

  for (const tx of transactions) {
    const d = normalizeMerchantDescriptor(tx.rawDescription || tx.cleanMerchant);
    const key = d.canonical.toLowerCase();

    let match = clusters.find((c) => c.key === key);
    if (!match && !d.isSubscriptionBrand) {
      match = clusters.find(
        (c) => calculateLevenshteinDistance(c.normalized, d.normalized) <= Math.max(1, Math.floor(Math.min(c.normalized.length, d.normalized.length) * 0.15))
      );
    }

    const item = { ...tx, cleanMerchant: match ? match.name : d.canonical };
    if (match) match.transactions.push(item);
    else clusters.push({ key, name: d.canonical, normalized: d.normalized, transactions: [item] });
  }

  const result = new Map<string, NormalizedTransaction[]>();
  for (const c of clusters) {
    const existing = result.get(c.key);
    result.set(c.key, existing ? existing.concat(c.transactions) : c.transactions);
  }
  return result;
}
