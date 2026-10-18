// End-to-end check of the bank statement import: real-format statements from
// HDFC, SBI, ICICI, Axis, Kotak, a credit card (CSV), Excel with real date
// cells, and PDFs (bank, card, password-locked), all built from the same six
// months of one student's spending. Every format must find the same set of
// subscriptions and nothing from everyday spending or friend transfers.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseRawCsv, autoDetectColumnMapping, normalizeTransactions } from './csvParser';
import { excelBufferToCsv } from './excelStatement';
import { extractTransactionsFromLines, groupTokensIntoLines, TextToken } from './pdfParser';
import { detectRecurringCandidates } from './recurringDetector';
import { NormalizedTransaction } from '../types';

const FIX = join(__dirname, '__fixtures__');
const truth: [string, string, number, boolean][] = JSON.parse(readFileSync(join(FIX, 'student-2026.json'), 'utf8'));
const debits = truth.filter((t) => t[3]);

function fromCsvText(text: string) {
  const { headers, rows } = parseRawCsv(text);
  const mapping = autoDetectColumnMapping(headers);
  return { mapping, txs: normalizeTransactions(rows, mapping) };
}

async function pdfLines(file: string, password?: string): Promise<TextToken[][]> {
  // @ts-ignore legacy build has no types entry
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(join(FIX, file))), password, isEvalSupported: false }).promise;
  const lines: TextToken[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    const tokens: TextToken[] = [];
    for (const item of content.items as { str?: string; transform: number[]; width: number; height: number }[]) {
      if (item.str && item.str.trim()) tokens.push({ str: item.str, x: item.transform[4], y: item.transform[5], width: item.width, height: item.height });
    }
    lines.push(...groupTokensIntoLines(tokens));
  }
  return lines;
}

const EXPECTED = ['Netflix', 'Spotify', 'Google One', 'ACT Fibernet', 'Jio', 'Amazon Prime'];
const MUST_NOT = /swiggy|zomato|rahul|verma|airtel|amazon$|^amazon \(|refund|ramesh|pocket|payment received/i;

function check(label: string, txs: NormalizedTransaction[], opts: { exactDebits?: boolean } = {}) {
  // Money out only, right dates, right amounts
  if (opts.exactDebits !== false) {
    expect(txs.length, `${label}: debit count`).toBe(debits.length);
    const got = txs.map((t) => `${t.date}|${t.amount}`).sort();
    const want = debits.map((t) => `${t[0]}|${t[2]}`).sort();
    expect(got, `${label}: dates and amounts`).toEqual(want);
  }
  const cands = detectRecurringCandidates(txs, [], 'INR');
  const names = cands.map((c) => c.merchantName);
  for (const e of EXPECTED) {
    expect(names.some((n) => n.toLowerCase().startsWith(e.toLowerCase())), `${label}: should find ${e}, got ${names.join(', ')}`).toBe(true);
  }
  const bad = names.filter((n) => MUST_NOT.test(n));
  expect(bad, `${label}: false subscriptions`).toEqual([]);
  const netflix = cands.find((c) => c.merchantName.startsWith('Netflix'))!;
  expect(netflix.amount, `${label}: Netflix latest price`).toBe(649);
  expect(netflix.billingCycle).toBe('monthly');
  const jio = cands.find((c) => c.merchantName.startsWith('Jio'))!;
  expect(jio.amount).toBe(349);
  return cands;
}

describe('bank statement import, end to end', () => {
  it.each(['hdfc.csv', 'axis.csv', 'kotak.csv'])('%s', (file) => {
    const { mapping, txs } = fromCsvText(readFileSync(join(FIX, file), 'utf8'));
    expect(mapping.dateColumn).toBeTruthy();
    check(file, txs);
  });

  it('sbi.xls (tab separated text with an .xls name)', () => {
    const csv = excelBufferToCsv(readFileSync(join(FIX, 'sbi.xls')));
    check('sbi.xls', fromCsvText(csv).txs);
  });

  it('icici.xls (real Excel 97 file with text dates)', () => {
    const csv = excelBufferToCsv(readFileSync(join(FIX, 'icici.xls')));
    check('icici.xls', fromCsvText(csv).txs);
  });

  it('xlsx with real date cells keeps day and month the right way round', () => {
    const csv = excelBufferToCsv(readFileSync(join(FIX, 'realdates.xlsx')));
    check('realdates.xlsx', fromCsvText(csv).txs);
  });

  it('credit card CSV with signed amounts and month-name dates', () => {
    const { txs } = fromCsvText(readFileSync(join(FIX, 'card.csv'), 'utf8'));
    check('card.csv', txs);
  });

  it('HDFC PDF with wrapped narrations and running balance', async () => {
    check('hdfc.pdf', extractTransactionsFromLines(await pdfLines('hdfc.pdf')));
  });

  it('credit card PDF with Cr markers', async () => {
    check('card.pdf', extractTransactionsFromLines(await pdfLines('card.pdf')));
  });

  it('password-locked PDF opens with the right password', async () => {
    await expect(pdfLines('hdfc-locked.pdf')).rejects.toMatchObject({ name: 'PasswordException' });
    check('hdfc-locked.pdf', extractTransactionsFromLines(await pdfLines('hdfc-locked.pdf', 'ABCDE1234F')));
  });
});
