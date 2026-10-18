import { describe, it, expect } from 'vitest';
import { parseRawCsv, autoDetectColumnMapping, normalizeTransactions } from './csvParser';
import { detectRecurringCandidates } from './recurringDetector';

// Three months of a typical Indian student's account: real subscriptions mixed with
// food orders, rent, an EMI, an SIP, petrol and money sent to friends.
const rows: [string, string, number][] = [];
for (const m of ['07', '08', '09']) {
  rows.push(
    [`05/${m}/2026`, 'UPI/NETFLIX COM/netflix@icici/Payment', 649],
    [`10/${m}/2026`, 'UPI/SPOTIFY INDIA/spotify@ybl/Premium', 119],
    [`01/${m}/2026`, 'NEFT/HOUSE RENT/MR SHARMA', 8000],
    [`03/${m}/2026`, 'ACH D- BAJAJ FINANCE EMI', 2499],
    [`07/${m}/2026`, 'NACH/SIP/ZERODHA MUTUAL FUND', 1000],
    [`15/${m}/2026`, 'UPI/RAHUL KUMAR/9876543210@ybl/hostel mess', 3000],
    [`20/${m}/2026`, 'UPI/AARAV/aarav.k@okaxis/split', 500],
    [`12/${m}/2026`, 'UPI/SWIGGY/swiggy@icici/order', 250 + Number(m) * 7],
    [`25/${m}/2026`, 'UPI/SWIGGY/swiggy@icici/order', 180 + Number(m) * 11],
    [`18/${m}/2026`, 'POS HPCL PETROL PUMP', 500],
    [`22/${m}/2026`, 'UPI/CULT GYM PUNE/cultgym@hdfcbank/membership', 1200]
  );
}
// Seen only twice: too little to call a subscription
rows.push(['11/08/2026', 'UPI/RANDOM STORE/randomstore@ybl/x', 300], ['11/09/2026', 'UPI/RANDOM STORE/randomstore@ybl/x', 300]);

const csv = ['Date,Description,Debit,Credit', ...rows.map(([d, desc, amt]) => `${d},${desc},${amt},`)].join('\n');

describe('import picks subscriptions, not everyday spending', () => {
  const raw = parseRawCsv(csv);
  const txs = normalizeTransactions(raw.rows, autoDetectColumnMapping(raw.headers));
  const found = detectRecurringCandidates(txs);
  const names = found.map((c) => c.merchantName.toLowerCase());
  const selected = found.filter((c) => c.selected).map((c) => c.merchantName.toLowerCase());

  it('finds and pre-selects known subscriptions', () => {
    expect(selected.some((n) => n.includes('netflix'))).toBe(true);
    expect(selected.some((n) => n.includes('spotify'))).toBe(true);
  });

  it('skips rent, EMI, SIP, petrol and transfers to people', () => {
    for (const word of ['rent', 'sharma', 'bajaj', 'emi', 'sip', 'zerodha', 'hpcl', 'petrol', 'rahul', 'aarav']) {
      expect(names.some((n) => n.includes(word)), word).toBe(false);
    }
  });

  it('skips food orders and merchants seen only twice', () => {
    expect(names.some((n) => n.includes('swiggy'))).toBe(false);
    expect(names.some((n) => n.includes('random'))).toBe(false);
  });

  it('shows an unknown monthly charge unticked so the user decides', () => {
    const gym = found.find((c) => c.merchantName.toLowerCase().includes('cult'));
    if (gym) expect(gym.selected).toBe(false);
  });
});

describe('only subscriptions, never daily spending with a fixed amount', () => {
  const r: string[] = [];
  for (const m of ['07', '08', '09', '10']) {
    r.push(
      `02/${m}/2026,UPI/SHREE DAIRY/shreedairy@ybl/milk,1500,`,
      `04/${m}/2026,UPI/ANNAPURNA TIFFIN/annatiffin@paytm/monthly,2400,`,
      `06/${m}/2026,UPI/SWIGGY/swiggy@icici/order,199,`,
      `09/${m}/2026,UBER INDIA SYSTEMS,150,`,
      `14/${m}/2026,POS LEETCODE.COM SUBSCRIPTION,999,`
    );
  }
  const raw = parseRawCsv(['Date,Description,Debit,Credit', ...r].join('\n'));
  const names = detectRecurringCandidates(normalizeTransactions(raw.rows, autoDetectColumnMapping(raw.headers))).map((c) =>
    c.merchantName.toLowerCase()
  );

  it('skips a milkman, tiffin, food orders and rides even at the same price every month', () => {
    for (const word of ['dairy', 'tiffin', 'annapurna', 'swiggy', 'uber']) {
      expect(names.some((n) => n.includes(word)), word).toBe(false);
    }
  });

  it('keeps an unknown online service that says subscription', () => {
    expect(names.some((n) => n.includes('leetcode'))).toBe(true);
  });
});
