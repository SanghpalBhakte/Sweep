// Shared helpers for reading bank and card statements (CSV, Excel and PDF).
// Written for Indian statements first (day-first dates, 1,23,456.78 amounts,
// Dr/Cr markers, withdrawal/deposit columns) while still reading US/EU files.

export type DateOrder = 'dmy' | 'mdy';
export type Direction = 'debit' | 'credit' | null;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const FULL_MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** Only real month words count ("Oct", "Sept", "October"), not "Marketing" or "Decathlon" */
function monthFromWord(word: string): number | undefined {
  const w = word.toLowerCase();
  if (MONTHS[w]) return MONTHS[w];
  const full = FULL_MONTHS.indexOf(w);
  return full >= 0 ? full + 1 : undefined;
}

const pad = (n: number) => String(n).padStart(2, '0');

function validYmd(y: number, m: number, d: number): string | null {
  if (!(y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null; // 31 Feb etc
  return `${y}-${pad(m)}-${pad(d)}`;
}

function fullYear(y: string): number {
  const n = parseInt(y, 10);
  return y.length <= 2 ? 2000 + n : n;
}

/**
 * Parse one date cell. Handles 05/10/2026, 05-10-26, 05.10.2026, 2026-10-05,
 * 05-Oct-2026, 05 Oct 2026, 5 October 26, Oct 05, 2026, and a time after the date.
 * Numeric dates with both parts <= 12 follow `order` (day first by default).
 * Never goes through `new Date(string)`, which shifts dates by a day in IST.
 */
export function parseStatementDate(raw: string, order: DateOrder = 'dmy', fallbackYear?: number): string | null {
  if (!raw) return null;
  const s = String(raw).trim().replace(/\s+/g, ' ');
  if (!s) return null;

  // ISO: 2026-10-05 or 2026/10/05 (optionally with time)
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) return validYmd(+m[1], +m[2], +m[3]);

  // Numeric: 05/10/2026, 5-10-26, 05.10.2026
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const y = fullYear(m[3]);
    if (a > 12) return validYmd(y, b, a);
    if (b > 12) return validYmd(y, a, b);
    return order === 'dmy' ? validYmd(y, b, a) : validYmd(y, a, b);
  }

  // 05-Oct-2026, 05 Oct 2026, 5 October, 26, 05Oct26
  m = s.match(/^(\d{1,2})[\s\-/.]*([A-Za-z]{3,9})\b[\s\-/.,']*(\d{4}|\d{2})?\b/);
  if (m) {
    const mon = monthFromWord(m[2]);
    if (mon) {
      const y = m[3] ? fullYear(m[3]) : fallbackYear ?? new Date().getFullYear();
      return validYmd(y, mon, +m[1]);
    }
  }

  // Oct 05, 2026 / October 5 2026 / Oct 05
  m = s.match(/^([A-Za-z]{3,9})\b[\s\-/.]*(\d{1,2})(?:st|nd|rd|th)?\b[\s,\-/.']*(\d{4}|\d{2})?\b/);
  if (m) {
    const mon = monthFromWord(m[1]);
    if (mon) {
      const y = m[3] ? fullYear(m[3]) : fallbackYear ?? new Date().getFullYear();
      return validYmd(y, mon, +m[2]);
    }
  }

  // Excel serial date numbers (e.g. 46300) that slipped through as text
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = parseFloat(s);
    if (serial > 30000 && serial < 80000) {
      const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
      return validYmd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    }
  }

  return null;
}

/** Looks like a date at all (used to skip value-date columns inside PDF rows). */
export function looksLikeDate(raw: string): boolean {
  return parseStatementDate(raw) !== null;
}

/**
 * Decide day-first vs month-first from a whole column. Any value with a first
 * part above 12 proves day-first; any second part above 12 proves month-first.
 * With no proof we assume day-first (India and most of the world).
 */
export function detectDateOrder(samples: string[], fallback: DateOrder = 'dmy'): DateOrder {
  let dmy = 0;
  let mdy = 0;
  for (const raw of samples) {
    const m = String(raw || '').trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/);
    if (!m) continue;
    if (+m[1] > 12) dmy++;
    else if (+m[2] > 12) mdy++;
  }
  if (dmy > mdy) return 'dmy';
  if (mdy > dmy) return 'mdy';
  return fallback;
}

/**
 * Parse a money cell. Handles ₹/Rs./INR/$/€/£, Indian grouping (1,23,456.78),
 * Western grouping, European decimals (1.234,56 or 14,99), (parentheses) and
 * leading/trailing minus as negative, and Dr/Cr markers.
 * Returns the absolute value, the sign, and an explicit direction when marked.
 */
export function parseMoney(raw: string): { value: number; negative: boolean; direction: Direction } | null {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (!s || s === '-' || s === '--') return null;

  let direction: Direction = null;
  const marker = s.match(/\b(dr|cr|debit|credit)\.?\s*$/i) || s.match(/^(dr|cr)\.?\b/i);
  if (marker) {
    direction = /^(dr|debit)$/i.test(marker[1]) ? 'debit' : 'credit';
    s = s.replace(marker[0], '').trim();
  }

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/(inr|rs\.?|usd|eur|gbp|[₹$€£])/gi, '').replace(/\s+/g, '');
  if (/^-|-$|^−/.test(s)) negative = true;
  if (/^\+/.test(s)) negative = false;
  s = s.replace(/^[+\-−]|-$/g, '');

  if (!/^[0-9.,]+$/.test(s) || !/\d/.test(s)) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized: string;
  if (lastComma > -1 && lastDot > -1) {
    // Whichever comes last is the decimal separator
    normalized = lastDot > lastComma ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  } else if (lastComma > -1) {
    // Only commas: "1,499" / "1,23,456" are thousands; "14,99" is a decimal
    const afterLast = s.length - lastComma - 1;
    const groups = s.split(',');
    const looksLikeThousands = afterLast === 3 && groups.slice(1).every((g) => g.length === 3 || g.length === 2);
    normalized = looksLikeThousands || (groups.length > 2) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1) {
    // 1.234.567 (dots as thousands)
    normalized = s.replace(/\./g, '');
  } else {
    normalized = s;
  }

  const value = parseFloat(normalized);
  if (!isFinite(value)) return null;
  return { value: Math.abs(value), negative, direction };
}

/** A token that is clearly an amount on a PDF line (needs decimals or grouping, so ref numbers and years don't count). */
export function looksLikeMoneyToken(token: string): boolean {
  const t = token.trim().replace(/\s*(dr|cr)\.?$/i, '').replace(/^(₹|rs\.?|inr)\s*/i, '');
  return /^[(\-−]?\d{1,3}(,\d{2,3})*(\.\d{1,2})[)]?-?$/.test(t) || /^[(\-−]?\d+\.\d{2}[)]?-?$/.test(t);
}

export function isDrCrToken(token: string): Direction {
  const t = token.trim().toLowerCase().replace(/\.$/, '');
  if (t === 'dr' || t === 'debit' || t === 'd') return 'debit';
  if (t === 'cr' || t === 'credit' || t === 'c') return 'credit';
  return null;
}

/** Split a header into lowercase words: "Withdrawal Amt." -> ["withdrawal","amt"] */
export function headerWords(header: string): string[] {
  return String(header || '')
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, ' ')
    .split(/[\s/]+/)
    .filter(Boolean);
}
