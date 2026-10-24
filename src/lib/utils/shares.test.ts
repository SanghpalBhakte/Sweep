import { describe, expect, it } from 'vitest';
import { buildShareRequest, buildUpiLink, isValidUpiId, shareSummary, suggestedShare } from './shares';

const sub = {
  amount: 229,
  next_renewal_date: '2026-11-05',
  shares: [
    { name: 'Rahul', amount: 57, paid_for: '2026-11-05' },
    { name: 'Priya', amount: 57, paid_for: '2026-10-05' },
  ],
};

describe('shares', () => {
  it('works out your part and what is still owed this cycle', () => {
    expect(shareSummary(sub)).toEqual({ yourPart: 115, stillOwed: 57 });
  });

  it('suggests an even split counting you', () => {
    expect(suggestedShare(sub)).toBe(57);
    expect(suggestedShare({ amount: 179, next_renewal_date: '2026-11-05' })).toBe(90);
  });

  it('checks UPI IDs', () => {
    expect(isValidUpiId('sonu@okaxis')).toBe(true);
    expect(isValidUpiId('9876543210@ybl')).toBe(true);
    expect(isValidUpiId('sonu')).toBe(false);
    expect(isValidUpiId('a@1')).toBe(false);
  });

  it('builds a UPI link with amount and note', () => {
    const link = buildUpiLink({ upiId: 'sonu@okaxis', payeeName: 'Sonu B', amount: 57, note: 'Spotify share' });
    expect(link).toBe('upi://pay?pa=sonu%40okaxis&pn=Sonu%20B&am=57.00&cu=INR&tn=Spotify%20share');
  });

  it('builds a WhatsApp message with the link', () => {
    const r = buildShareRequest({ friend: 'Rahul', subName: 'Spotify', amount: 57, upiId: 'sonu@okaxis', payeeName: 'Sonu' });
    expect(r.whatsapp.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(r.whatsapp)).toContain(r.upi);
    expect(r.text).toContain('sonu@okaxis');
    expect(r.text).not.toMatch(/—|--/);
  });
});
