import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseRawCsv, autoDetectColumnMapping, normalizeTransactions, cleanMerchantDescription } from './csvParser';
import { detectRecurringCandidates, isAlreadyTracked } from './recurringDetector';
import { NormalizedTransaction } from '../types';

const FIX = join(__dirname, '__fixtures__');

function tx(date: string, desc: string, amount: number): NormalizedTransaction {
  return { id: `${date}-${desc}`, date, rawDescription: desc, cleanMerchant: cleanMerchantDescription(desc), amount };
}

describe('CSV parser', () => {
  it('skips the account details at the top and the note at the bottom (SBI)', () => {
    const { headers, rows } = parseRawCsv(readFileSync(join(FIX, 'sbi.csv'), 'utf8'));
    expect(headers[0]).toBe('Txn Date');
    const mapping = autoDetectColumnMapping(headers);
    expect(mapping).toMatchObject({ dateColumn: 'Txn Date', descriptionColumn: 'Description', debitColumn: 'Debit', creditColumn: 'Credit' });
    const txs = normalizeTransactions(rows, mapping);
    // DD-MM-YY dates, money out only
    expect(txs[0].date).toBe('2026-05-02');
    expect(txs.every((t) => !/POCKET MONEY/.test(t.rawDescription))).toBe(true);
  });

  it('reads ICICI headers with (INR ) in them', () => {
    const { headers } = parseRawCsv(readFileSync(join(FIX, 'icici.csv'), 'utf8'));
    const mapping = autoDetectColumnMapping(headers);
    expect(mapping.debitColumn).toBe('Withdrawal Amount (INR )');
    expect(mapping.descriptionColumn).toBe('Transaction Remarks');
  });

  it('gives nothing back for a file that is not a statement', () => {
    const { headers, rows } = parseRawCsv('hello world\njust some notes\n');
    expect(normalizeTransactions(rows, autoDetectColumnMapping(headers))).toEqual([]);
    expect(parseRawCsv('').rows).toEqual([]);
  });
});

describe('merchant names', () => {
  it.each([
    ['UPI/DR/429812345678/NETFLIX/ICIC/netflixupi@icici/Payment', 'Netflix'],
    ['NACH DR SPOTIFY INDIA 12345678', 'Spotify'],
    ['ECS/GOOGLE PLAY/987654', 'Google Play'],
    ['ACH D- TP ACH YOUTUBE PREMIUM-YT88234', 'YouTube Premium'],
    ['POS 4591XXXXXX1234 AMAZON PRIME MUMBAI', 'Amazon Prime'],
    ['UPI/DR/429812345678/PIXELHOST CLOUD/HDFC/pixelhost@hdfcbank/Monthly plan', 'Pixelhost Cloud'],
  ])('%s', (raw, clean) => {
    expect(cleanMerchantDescription(raw)).toBe(clean);
  });
});

describe('subscription detector', () => {
  it('finds a monthly plan from 2 charges', () => {
    const c = detectRecurringCandidates([
      tx('2026-08-05', 'UPI/DR/1111/NETFLIX/ICIC/netflix@icici', 649),
      tx('2026-09-05', 'UPI/DR/2222/NETFLIX/ICIC/netflix@icici', 649),
    ]);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ merchantName: 'Netflix', billingCycle: 'monthly', estimatedNextRenewal: expect.any(String) });
  });

  it('finds a weekly plan', () => {
    const c = detectRecurringCandidates(
      ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22'].map((d) => tx(d, 'NACH DR SPOTIFY INDIA 1234', 39))
    );
    expect(c[0]).toMatchObject({ billingCycle: 'custom', frequencyDays: 7 });
  });

  it('allows a small change in amount', () => {
    const c = detectRecurringCandidates([
      tx('2026-07-10', 'POS 4591XX1234 GOOGLE ONE', 130),
      tx('2026-08-10', 'POS 4591XX1234 GOOGLE ONE', 130),
      tx('2026-09-10', 'POS 4591XX1234 GOOGLE ONE', 135),
    ]);
    expect(c[0].merchantName).toBe('Google One');
  });

  it('ignores food orders with changing amounts', () => {
    const c = detectRecurringCandidates([
      tx('2026-09-01', 'UPI-SWIGGY-swiggy.stores@axb-Order', 189),
      tx('2026-09-09', 'UPI-SWIGGY-swiggy.stores@axb-Order', 412),
      tx('2026-09-30', 'UPI-SWIGGY-swiggy.stores@axb-Order', 265),
    ]);
    expect(c).toEqual([]);
  });

  it('knows what is already tracked', () => {
    expect(isAlreadyTracked('Netflix', ['netflix '])).toBe(true);
    expect(isAlreadyTracked('Spotify (₹119)', ['Spotify'])).toBe(true);
    expect(isAlreadyTracked('Spotify', ['Netflix'])).toBe(false);
    expect(isAlreadyTracked('Spotify', ['Spotify Premium'])).toBe(true);
    expect(isAlreadyTracked('Google One', ['Google Play'])).toBe(false);
    expect(isAlreadyTracked('Jio', ['JioHotstar'])).toBe(false);
  });
});
