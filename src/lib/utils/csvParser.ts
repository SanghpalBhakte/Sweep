import { CsvColumnMapping, NormalizedTransaction } from '../types';
import { normalizeMerchantDescriptor } from './merchantMatcher';
import { detectDateOrder, headerWords, parseMoney, parseStatementDate } from './statementParsing';

const DATE_WORDS = ['date', 'dt', 'posted', 'posting', 'booking'];
const MONEY_WORDS = ['amount', 'amt', 'debit', 'credit', 'withdrawal', 'withdrawals', 'deposit', 'deposits', 'dr', 'cr', 'inr', 'charge', 'spent'];
const DESC_WORDS = ['narration', 'description', 'particulars', 'details', 'remarks', 'merchant', 'payee', 'memo', 'name', 'transaction'];

/**
 * Reads CSV text into header + row objects. Indian bank exports usually start
 * with a block of account details, so the real header row is found by looking
 * for a row that names a date column and a money column.
 */
export function parseRawCsv(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
  const cleanText = csvText.replace(/^﻿/, '').trim();
  if (!cleanText) return { headers: [], rows: [] };

  const delimiter = detectDelimiter(cleanText);
  const lines = parseCsvLines(cleanText, delimiter);
  if (lines.length === 0) return { headers: [], rows: [] };

  return rowsFromTable(lines);
}

/** Same as parseRawCsv but for a table that is already split into cells (Excel files). */
export function rowsFromTable(lines: string[][]): { headers: string[]; rows: Record<string, string>[] } {
  const table = lines
    .map((cells) => cells.map((c) => (c === null || c === undefined ? '' : String(c))))
    .filter((cells) => cells.some((c) => c.trim().length > 0));
  if (table.length === 0) return { headers: [], rows: [] };

  const headerIndex = findHeaderRow(table);
  const rawHeaders = table[headerIndex].map((h) => h.replace(/\s+/g, ' ').trim());

  // Unique, non-empty header names
  const seen: Record<string, number> = {};
  const headers = rawHeaders.map((h, i) => {
    const base = h || `Column ${i + 1}`;
    seen[base] = (seen[base] || 0) + 1;
    return seen[base] > 1 ? `${base} (${seen[base]})` : base;
  });

  const rows: Record<string, string>[] = [];
  for (let i = headerIndex + 1; i < table.length; i++) {
    const values = table[i];
    // Banks repeat the header row on every page of an export
    if (values.map((v) => v.trim()).join('|') === rawHeaders.join('|')) continue;
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] || '').trim();
    });
    rows.push(row);
  }

  return { headers, rows };
}

function detectDelimiter(text: string): string {
  // Look at several lines, since the first one is often "Account Name : ..."
  const sample = text.split(/\r\n|\n/).slice(0, 40);
  const score = (d: string) =>
    sample.reduce((best, line) => Math.max(best, line.split(d).length - 1), 0);
  const candidates: [string, number][] = [
    [',', score(',')],
    [';', score(';')],
    ['\t', score('\t')],
    ['|', score('|')],
  ];
  candidates.sort((a, b) => b[1] - a[1]);
  return candidates[0][1] > 0 ? candidates[0][0] : ',';
}

function isHeaderLike(cells: string[]): boolean {
  const words = cells.map((c) => headerWords(c));
  const hasDate = words.some((w) => w.some((x) => DATE_WORDS.includes(x)));
  const hasMoney = words.some((w) => w.some((x) => MONEY_WORDS.includes(x)));
  const filled = cells.filter((c) => c.trim()).length;
  return hasDate && hasMoney && filled >= 3;
}

function findHeaderRow(table: string[][]): number {
  const limit = Math.min(table.length, 60);
  for (let i = 0; i < limit; i++) {
    if (isHeaderLike(table[i])) return i;
  }
  // No obvious header: use the first row that has at least 3 filled cells
  for (let i = 0; i < limit; i++) {
    if (table[i].filter((c) => c.trim()).length >= 3) return i;
  }
  return 0;
}

/**
 * Character-by-character parser handling quoted cells and escaped quotes
 */
function parseCsvLines(text: string, delimiter: string): string[][] {
  const result: string[][] = [];
  let currentLine: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentLine.push(currentCell);
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentLine.push(currentCell);
      if (currentLine.some((c) => c.trim().length > 0)) result.push(currentLine);
      currentLine = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentLine.length > 0) {
    currentLine.push(currentCell);
    if (currentLine.some((c) => c.trim().length > 0)) result.push(currentLine);
  }

  return result;
}

/**
 * Picks the date, description and money columns by matching whole words in the
 * headers (so "Description" no longer matches "cr", and "Value Dt" is never
 * taken as an amount). Works for HDFC, SBI, ICICI, Axis, Kotak and card exports.
 */
export function autoDetectColumnMapping(headers: string[]): CsvColumnMapping {
  const info = headers.map((h) => ({ h, w: headerWords(h) }));
  const has = (w: string[], ...keys: string[]) => keys.some((k) => w.includes(k));
  const pick = (score: (w: string[], h: string) => number): string => {
    let best = '';
    let bestScore = 0;
    for (const { h, w } of info) {
      const s = score(w, h);
      if (s > bestScore) {
        best = h;
        bestScore = s;
      }
    }
    return best;
  };

  const isBalance = (w: string[]) => has(w, 'balance', 'bal');
  const isTypeCol = (w: string[], h: string) =>
    /^(dr\s*\/\s*cr|cr\s*\/\s*dr|debit\s*\/\s*credit|type|txn type|transaction type|dr cr|cr dr)$/i.test(h.trim());

  const dateColumn =
    pick((w) => {
      if (!has(w, 'date', 'dt')) return 0;
      if (has(w, 'value')) return 1; // value date only as a last resort
      if (has(w, 'txn', 'transaction', 'tran', 'trans', 'posting', 'posted', 'booking')) return 4;
      return 3;
    }) || headers[0] || '';

  const descriptionColumn =
    pick((w) => {
      if (isBalance(w)) return 0;
      if (has(w, 'narration', 'particulars', 'description')) return 5;
      if (has(w, 'details', 'remarks', 'merchant', 'payee')) return 4;
      if (has(w, 'memo', 'name')) return 2;
      if (has(w, 'transaction') && !has(w, 'date', 'dt', 'amount', 'amt', 'id', 'no', 'type')) return 2;
      return 0;
    }) || headers.find((h) => h !== dateColumn) || '';

  const typeColumn = info.find(({ h, w }) => isTypeCol(w, h))?.h;

  const debitColumn = pick((w, h) => {
    if (isBalance(w) || isTypeCol(w, h)) return 0;
    if (has(w, 'withdrawal', 'withdrawals', 'debit', 'debits', 'paid')) return 3;
    if (has(w, 'dr') && !has(w, 'cr')) return 2;
    if (has(w, 'out') && has(w, 'money')) return 3;
    return 0;
  });

  const creditColumn = pick((w, h) => {
    if (isBalance(w) || isTypeCol(w, h)) return 0;
    if (has(w, 'deposit', 'deposits', 'credit', 'credits', 'received')) return 3;
    if (has(w, 'cr') && !has(w, 'dr')) return 2;
    if (has(w, 'in') && has(w, 'money')) return 3;
    return 0;
  });

  const plainAmount = pick((w, h) => {
    if (isBalance(w) || isTypeCol(w, h) || has(w, 'date', 'dt')) return 0;
    if (has(w, 'withdrawal', 'deposit', 'debit', 'credit')) return 0;
    if (has(w, 'amount', 'amt')) return 3;
    if (has(w, 'inr', 'charge', 'spent', 'value') && !has(w, 'date')) return 1;
    return 0;
  });

  const split = Boolean(debitColumn && creditColumn && debitColumn !== creditColumn);
  const amountColumn = split ? debitColumn : plainAmount || debitColumn || '';

  return {
    dateColumn,
    descriptionColumn,
    amountColumn,
    debitColumn: split ? debitColumn : undefined,
    creditColumn: split ? creditColumn : undefined,
    typeColumn: !split ? typeColumn : undefined,
  };
}

/**
 * Turns rows into money-out transactions only. Credits (salary, refunds,
 * cashback) are dropped, so they can never show up as subscriptions.
 */
export function normalizeTransactions(
  rows: Record<string, string>[],
  mapping: CsvColumnMapping
): NormalizedTransaction[] {
  const amountCol = mapping.amountColumn || mapping.debitColumn || '';
  if (!amountCol || !mapping.dateColumn) return [];

  const splitMode = Boolean(mapping.creditColumn && mapping.creditColumn !== amountCol);
  const order = detectDateOrder(rows.map((r) => r[mapping.dateColumn] || ''));

  // Single signed column: whichever sign most rows have is money out.
  // Bank exports show debits as negative; card exports show charges as positive.
  let negativeIsDebit = true;
  if (!splitMode) {
    let neg = 0;
    let pos = 0;
    for (const r of rows) {
      const m = parseMoney(r[amountCol] || '');
      if (!m || m.value === 0 || m.direction) continue;
      if (m.negative) neg++;
      else pos++;
    }
    negativeIsDebit = neg >= pos;
  }

  const out: NormalizedTransaction[] = [];
  rows.forEach((row, index) => {
    const date = parseStatementDate(row[mapping.dateColumn] || '', order);
    if (!date) return; // totals, footers, opening balance rows

    const money = parseMoney(row[amountCol] || '');
    if (!money || money.value <= 0) return;

    let isDebit: boolean;
    if (splitMode) {
      isDebit = money.direction !== 'credit';
    } else {
      const typeCell = mapping.typeColumn ? (row[mapping.typeColumn] || '').trim().toLowerCase() : '';
      if (/^(cr|c|credit|cr\.)$/.test(typeCell)) isDebit = false;
      else if (/^(dr|d|debit|dr\.)$/.test(typeCell)) isDebit = true;
      else if (money.direction) isDebit = money.direction === 'debit';
      else isDebit = money.negative === negativeIsDebit;
    }
    if (!isDebit) return;

    const rawDescription = (row[mapping.descriptionColumn] || '').trim();
    const cleanMerchant = cleanMerchantDescription(rawDescription);
    if (!cleanMerchant) return;

    out.push({
      id: `tx-${index}-${date}`,
      date,
      rawDescription,
      cleanMerchant,
      amount: Math.round(money.value * 100) / 100,
    });
  });

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Cleans noisy bank statement merchant strings via centralized merchantMatcher
 */
export function cleanMerchantDescription(rawDesc: string): string {
  if (!rawDesc) return '';
  const result = normalizeMerchantDescriptor(rawDesc);
  return result.canonical || result.normalized || rawDesc.trim();
}
