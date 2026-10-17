import { describe, it, expect } from 'vitest';
import { rollForwardRenewalDate } from './dates';

describe('rollForwardRenewalDate', () => {
  const today = new Date(2026, 9, 18); // 18 Oct 2026

  it('leaves future and today dates alone', () => {
    expect(rollForwardRenewalDate('2026-10-18', 'monthly', null, today)).toBe('2026-10-18');
    expect(rollForwardRenewalDate('2027-01-11', 'monthly', null, today)).toBe('2027-01-11');
  });

  it('moves a past monthly date to the next one on or after today', () => {
    expect(rollForwardRenewalDate('2026-08-28', 'monthly', null, today)).toBe('2026-10-28');
    expect(rollForwardRenewalDate('2026-10-09', 'monthly', null, today)).toBe('2026-11-09');
  });

  it('keeps month ends from drifting', () => {
    expect(rollForwardRenewalDate('2026-01-31', 'monthly', null, new Date(2026, 2, 1))).toBe('2026-03-31');
  });

  it('handles quarterly, yearly and custom cycles', () => {
    expect(rollForwardRenewalDate('2026-09-14', 'quarterly', null, today)).toBe('2026-12-14');
    expect(rollForwardRenewalDate('2025-09-26', 'yearly', null, today)).toBe('2027-09-26');
    expect(rollForwardRenewalDate('2026-10-09', 'custom', 7, today)).toBe('2026-10-23');
  });
});
