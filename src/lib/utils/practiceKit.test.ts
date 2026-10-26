// Runs every statement in practice-kit/ through the real import code and checks
// the result against practice-kit/expected.json (made by practice-kit/generate.py).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseRawCsv, autoDetectColumnMapping, normalizeTransactions } from './csvParser';
import { detectRecurringCandidates } from './recurringDetector';

const KIT = join(__dirname, '../../../practice-kit');
const expected = JSON.parse(readFileSync(join(KIT, 'expected.json'), 'utf8')) as {
  debits: [string, number][];
  must_find: Record<string, { amount: number; cycle: string; days?: number }>;
  must_not_find: string[];
};

describe.each(['hdfc', 'sbi', 'icici', 'axis', 'card'])('practice kit: %s', (bank) => {
  const { headers, rows } = parseRawCsv(readFileSync(join(KIT, `${bank}-practice.csv`), 'utf8'));
  const txs = normalizeTransactions(rows, autoDetectColumnMapping(headers));
  const found = detectRecurringCandidates(txs, [], 'INR');

  it('reads every payment out with the right date and amount, and nothing else', () => {
    const got = txs.map((t) => `${t.date}|${t.amount}`).sort();
    const want = expected.debits.map(([d, a]) => `${d}|${a}`).sort();
    expect(got).toEqual(want);
  });

  it.each(Object.entries(expected.must_find))('finds %s', (name, exp) => {
    const c = found.find((x) => x.merchantName.toLowerCase().startsWith(name.toLowerCase()));
    expect(c, `found: ${found.map((x) => x.merchantName).join(', ')}`).toBeTruthy();
    expect(c!.amount).toBe(exp.amount);
    expect(c!.billingCycle).toBe(exp.cycle);
    if (exp.days) expect(c!.frequencyDays).toBe(exp.days);
  });

  it('does not treat rent, EMI, friends, bills or food orders as subscriptions', () => {
    const bad = found.filter((c) => expected.must_not_find.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(c.merchantName)));
    expect(bad.map((c) => c.merchantName)).toEqual([]);
    expect(found.length).toBe(Object.keys(expected.must_find).length);
  });
});
