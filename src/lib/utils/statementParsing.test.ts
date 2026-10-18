import { describe, it, expect } from 'vitest';
import { parseStatementDate, parseMoney, detectDateOrder } from './statementParsing';
import { autoDetectColumnMapping } from './csvParser';
import { normalizeMerchantDescriptor } from './merchantMatcher';

describe('parseStatementDate', () => {
  it('reads Indian day-first dates', () => {
    expect(parseStatementDate('05/10/2026')).toBe('2026-10-05');
    expect(parseStatementDate('05/10/26')).toBe('2026-10-05');
    expect(parseStatementDate('05-10-2026')).toBe('2026-10-05');
    expect(parseStatementDate('5 Oct 2026')).toBe('2026-10-05');
    expect(parseStatementDate('05-Oct-26')).toBe('2026-10-05');
    expect(parseStatementDate('05/10/2026 14:32:10')).toBe('2026-10-05');
  });
  it('reads ISO and US month-first when told to', () => {
    expect(parseStatementDate('2026-10-05')).toBe('2026-10-05');
    expect(parseStatementDate('10/05/2026', 'mdy')).toBe('2026-10-05');
    expect(parseStatementDate('Oct 5, 2026')).toBe('2026-10-05');
  });
  it('rejects impossible dates and non-dates', () => {
    expect(parseStatementDate('31/02/2026')).toBeNull();
    expect(parseStatementDate('Opening Balance')).toBeNull();
    expect(parseStatementDate('Marketing 2026')).toBeNull();
  });
  it('works out the order from the whole column', () => {
    expect(detectDateOrder(['05/10/2026', '25/10/2026'])).toBe('dmy');
    expect(detectDateOrder(['10/05/2026', '10/25/2026'])).toBe('mdy');
    expect(detectDateOrder(['05/10/2026'])).toBe('dmy');
  });
});

describe('parseMoney', () => {
  it('reads Indian and Western grouping', () => {
    expect(parseMoney('1,23,456.78')?.value).toBe(123456.78);
    expect(parseMoney('1,499.00')?.value).toBe(1499);
    expect(parseMoney('₹ 649')?.value).toBe(649);
    expect(parseMoney('Rs. 1,060.00')?.value).toBe(1060);
  });
  it('reads European decimals', () => {
    expect(parseMoney('14,99')?.value).toBe(14.99);
    expect(parseMoney('1.234,56')?.value).toBe(1234.56);
  });
  it('reads signs and Dr/Cr markers', () => {
    expect(parseMoney('(1,499.00)')).toMatchObject({ value: 1499, negative: true });
    expect(parseMoney('-649.00')).toMatchObject({ value: 649, negative: true });
    expect(parseMoney('649.00 Dr')).toMatchObject({ value: 649, direction: 'debit' });
    expect(parseMoney('8,000.00 Cr')).toMatchObject({ value: 8000, direction: 'credit' });
  });
  it('ignores empty and non-money cells', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('-')).toBeNull();
    expect(parseMoney('05/10/26')).toBeNull();
  });
});

describe('autoDetectColumnMapping', () => {
  it('never takes "Value Dt" as the amount or "Description" as credit', () => {
    const m = autoDetectColumnMapping(['Date', 'Narration', 'Chq./Ref.No.', 'Value Dt', 'Withdrawal Amt.', 'Deposit Amt.', 'Closing Balance']);
    expect(m).toMatchObject({ dateColumn: 'Date', descriptionColumn: 'Narration', amountColumn: 'Withdrawal Amt.', creditColumn: 'Deposit Amt.' });
    const k = autoDetectColumnMapping(['Sl. No.', 'Transaction Date', 'Value Date', 'Description', 'Amount', 'Dr / Cr', 'Balance']);
    expect(k).toMatchObject({ dateColumn: 'Transaction Date', descriptionColumn: 'Description', amountColumn: 'Amount', typeColumn: 'Dr / Cr' });
  });
});

describe('merchant names', () => {
  it('names subscriptions from UPI, NACH and card narrations', () => {
    expect(normalizeMerchantDescriptor('UPI-SPOTIFY INDIA-spotify.bdsi@icici-ICIC0DC0099-418412345678-UPI Mandate').canonical).toBe('Spotify');
    expect(normalizeMerchantDescriptor('ACH D- TP ACH NETFLIX-NFX09238472').canonical).toBe('Netflix');
    expect(normalizeMerchantDescriptor('NETFLIX.COM MUMBAI').canonical).toBe('Netflix');
  });
  it('does not turn a friend on an @airtel UPI ID into Airtel', () => {
    const r = normalizeMerchantDescriptor('UPI-RAHUL VERMA-9876543210@airtel-AIRP0000001-425512345111-chai');
    expect(r.canonical).toBe('Rahul Verma');
    expect(r.isSubscriptionBrand).toBe(false);
  });
});
