import { NormalizedTransaction } from '../types';
import { cleanMerchantDescription } from './csvParser';
import {
  DateOrder,
  detectDateOrder,
  headerWords,
  isDrCrToken,
  looksLikeMoneyToken,
  parseMoney,
  parseStatementDate,
} from './statementParsing';

export interface PdfParseResult {
  success: boolean;
  transactions: NormalizedTransaction[];
  pageCount: number;
  totalTextLines: number;
  error?: string;
  isScannedOrImageOnly?: boolean;
  needsPassword?: boolean;
}

export interface TextToken {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Client-side PDF statement reader using pdf.js. Nothing leaves the device.
 */
export async function parsePdfStatement(file: File, password?: string): Promise<PdfParseResult> {
  try {
    const pdfjsLib = await import('pdfjs-dist');

    // Worker is served from our own origin (copied by scripts/copy-pdf-worker.mjs)
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: true,
      isEvalSupported: false,
      ...(password ? { password } : {}),
    });

    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    if (numPages === 0) {
      return { success: false, transactions: [], pageCount: 0, totalTextLines: 0, error: 'The PDF document is empty.' };
    }

    const allLines: TextToken[][] = [];
    let totalCharCount = 0;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageTokens: TextToken[] = [];

      for (const item of textContent.items) {
        if ('str' in item && item.str && item.str.trim()) {
          totalCharCount += item.str.length;
          pageTokens.push({
            str: item.str,
            x: item.transform[4],
            y: item.transform[5],
            width: item.width || 0,
            height: item.height || 0,
          });
        }
      }
      allLines.push(...groupTokensIntoLines(pageTokens));
    }

    if (totalCharCount < 60 || allLines.length < 3) {
      return {
        success: false,
        transactions: [],
        pageCount: numPages,
        totalTextLines: allLines.length,
        isScannedOrImageOnly: true,
        error:
          "This PDF looks like a scanned image, so there's no text to read. Download the statement again from net banking (not a photo or scan), or export it as CSV or Excel.",
      };
    }

    const transactions = extractTransactionsFromLines(allLines);

    if (transactions.length === 0) {
      return {
        success: false,
        transactions: [],
        pageCount: numPages,
        totalTextLines: allLines.length,
        error:
          "Couldn't find any payments in this PDF. Try the CSV or Excel download from your bank's net banking instead, it works with every bank.",
      };
    }

    return { success: true, transactions, pageCount: numPages, totalTextLines: allLines.length };
  } catch (err: any) {
    // Indian e-statements are often locked with PAN, mobile number or date of birth
    if (err?.name === 'PasswordException') {
      const isIncorrect = err.code === 2;
      return {
        success: false,
        transactions: [],
        pageCount: 0,
        totalTextLines: 0,
        needsPassword: true,
        error: isIncorrect
          ? "That password didn't work. Check it and try again."
          : 'This PDF is password protected. Banks usually set it to your PAN, mobile number, or date of birth. Enter it below to continue.',
      };
    }

    console.error('PDF parsing error:', err);
    return {
      success: false,
      transactions: [],
      pageCount: 0,
      totalTextLines: 0,
      error: `Couldn't read this PDF: ${err.message || 'unknown error'}`,
    };
  }
}

/**
 * Groups tokens that share a Y position into lines, left to right.
 * Exported for tests.
 */
export function groupTokensIntoLines(tokens: TextToken[]): TextToken[][] {
  if (tokens.length === 0) return [];
  const sorted = [...tokens].sort((a, b) => (Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x));

  const lines: TextToken[][] = [];
  let current: TextToken[] = [];
  let currentY = sorted[0].y;

  for (const t of sorted) {
    if (Math.abs(t.y - currentY) <= 3) {
      current.push(t);
    } else {
      if (current.length) lines.push(current.sort((a, b) => a.x - b.x));
      current = [t];
      currentY = t.y;
    }
  }
  if (current.length) lines.push(current.sort((a, b) => a.x - b.x));
  return lines;
}

interface Columns {
  debitRight?: number;
  creditRight?: number;
  balanceRight?: number;
  amountRight?: number;
}

const SKIP_LINE = /\b(opening balance|closing balance|beginning balance|ending balance|total|sub ?total|statement (period|summary|date)|account (number|no|summary)|page \d|brought forward|carried forward|b\/f|c\/f|interest rate|minimum amount due|payment due)\b/i;

function detectColumns(line: TextToken[]): Columns | null {
  const words = line.map((t) => headerWords(t.str));
  const flat = words.flat();
  const hasDate = flat.some((w) => w === 'date' || w === 'dt');
  const hasMoney = flat.some((w) => ['withdrawal', 'withdrawals', 'debit', 'debits', 'deposit', 'deposits', 'credit', 'credits', 'amount', 'amt', 'balance', 'dr', 'cr'].includes(w));
  if (!hasDate || !hasMoney) return null;

  const cols: Columns = {};
  line.forEach((t, i) => {
    const w = words[i];
    const right = t.x + t.width;
    if (w.some((x) => ['balance', 'bal'].includes(x))) cols.balanceRight = right;
    else if (w.some((x) => ['withdrawal', 'withdrawals', 'debit', 'debits'].includes(x)) || (w.includes('dr') && !w.includes('cr'))) cols.debitRight = right;
    else if (w.some((x) => ['deposit', 'deposits', 'credit', 'credits'].includes(x)) || (w.includes('cr') && !w.includes('dr'))) cols.creditRight = right;
    else if (w.some((x) => ['amount', 'amt'].includes(x))) cols.amountRight = right;
  });
  return Object.keys(cols).length ? cols : null;
}

function nearestColumn(right: number, cols: Columns): keyof Columns | null {
  let best: keyof Columns | null = null;
  let bestDist = Infinity;
  (Object.keys(cols) as (keyof Columns)[]).forEach((k) => {
    const d = Math.abs((cols[k] as number) - right);
    if (d < bestDist) {
      best = k;
      bestDist = d;
    }
  });
  return bestDist < 90 ? best : null;
}

interface RawRow {
  dateText: string;
  desc: string[];
  debit: number | null;
  credit: number | null;
  balance: number | null;
  unknown: { value: number; direction: 'debit' | 'credit' | null }[];
  lineIndex: number;
}

/**
 * Reads transaction rows from positioned text lines. Uses the column header
 * (Withdrawal / Deposit / Balance, Debit / Credit, Amount) to tell which number
 * is which. Without a header, the running balance decides debit vs credit.
 * Exported for tests.
 */
export function extractTransactionsFromLines(lines: TextToken[][]): NormalizedTransaction[] {
  let cols: Columns | null = null;
  const rows: RawRow[] = [];
  let lastRow: RawRow | null = null;
  let continuation = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.map((t) => t.str).join(' ').trim();

    const header = detectColumns(line);
    if (header) {
      cols = header;
      lastRow = null;
      continue;
    }

    // Find a date in the first few tokens. Some PDFs split "05 Oct 2026" into
    // three tokens, so short pieces may be joined, but a joined span may only
    // hold date-sized bits. Otherwise "05/10/26 NETFLIX 649.00" would be read as
    // one date and swallow the merchant name and the amount with it.
    let dateText = '';
    let dateEnd = -1;
    const datePiece = /^(\d{1,4}|[A-Za-z]{3,9})[,.']?$/;
    for (let t = 0; t < Math.min(line.length, 3) && !dateText; t++) {
      for (let span = 3; span >= 1; span--) {
        const pieces = line.slice(t, t + span).map((x) => x.str.trim());
        if (pieces.length < span) continue;
        if (span > 1 && !pieces.every((p) => datePiece.test(p))) continue;
        const joined = pieces.join(' ');
        if (parseStatementDate(joined, 'dmy', 2000)) {
          dateText = joined;
          dateEnd = t + span;
          break;
        }
      }
    }

    if (!dateText) {
      // Narration that wrapped onto the next line belongs to the row above
      if (lastRow && continuation < 2 && !SKIP_LINE.test(text) && !line.some((t) => looksLikeMoneyToken(t.str))) {
        lastRow.desc.push(text);
        continuation++;
      }
      continue;
    }
    if (SKIP_LINE.test(text)) {
      lastRow = null;
      continue;
    }

    const row: RawRow = { dateText, desc: [], debit: null, credit: null, balance: null, unknown: [], lineIndex: i };
    for (let t = dateEnd; t < line.length; t++) {
      const tok = line[t];
      const str = tok.str.trim();
      if (looksLikeMoneyToken(str)) {
        // "1,499.00" "Dr" can be two tokens
        const next = line[t + 1] ? isDrCrToken(line[t + 1].str) : null;
        const money = parseMoney(next ? `${str} ${line[t + 1].str}` : str);
        if (next) t++;
        if (!money) continue;
        const direction = money.direction || (money.negative ? 'debit' : null);
        const col = cols ? nearestColumn(tok.x + tok.width, cols) : null;
        if (col === 'balanceRight') row.balance = money.value;
        else if (col === 'debitRight') row.debit = money.value;
        else if (col === 'creditRight') row.credit = money.value;
        else row.unknown.push({ value: money.value, direction });
      } else if (!isDrCrToken(str) && !parseStatementDate(str, 'dmy', 2000)) {
        row.desc.push(str);
      }
    }

    rows.push(row);
    lastRow = row;
    continuation = 0;
  }

  // Resolve debit vs credit for rows without a clear column
  const order: DateOrder = detectDateOrder(rows.map((r) => r.dateText));
  let prevBalance: number | null = null;
  const out: NormalizedTransaction[] = [];

  for (const r of rows) {
    let amount: number | null = null;
    let isDebit = true;

    if (r.debit !== null || r.credit !== null) {
      if (r.debit !== null && r.debit > 0) amount = r.debit;
      else isDebit = false;
    } else if (r.unknown.length > 0) {
      // Last unknown number is the balance when there are two or more
      let balance = r.balance;
      let candidates = r.unknown;
      if (balance === null && candidates.length >= 2 && !candidates[candidates.length - 1].direction) {
        balance = candidates[candidates.length - 1].value;
        candidates = candidates.slice(0, -1);
      }
      const pick = candidates[candidates.length - 1];
      amount = pick.value;
      if (pick.direction) {
        isDebit = pick.direction === 'debit';
      } else if (balance !== null && prevBalance !== null) {
        if (Math.abs(prevBalance + amount - balance) < 0.02) isDebit = false;
      }
      if (balance !== null) r.balance = balance;
    }

    if (r.balance !== null) prevBalance = r.balance;
    if (!isDebit || amount === null || amount <= 0) continue;

    const date = parseStatementDate(r.dateText, order);
    const rawDescription = r.desc.join(' ').replace(/\s+/g, ' ').trim();
    if (!date || rawDescription.length < 2) continue;

    const cleanMerchant = cleanMerchantDescription(rawDescription);
    if (!cleanMerchant) continue;

    out.push({
      id: `pdf-tx-${r.lineIndex}-${date}`,
      date,
      rawDescription,
      cleanMerchant,
      amount: Math.round(amount * 100) / 100,
    });
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}
