import { describe, expect, it } from 'vitest';
import { studentPlanHint } from './popularServices';

const sub = { name: 'Spotify', amount: 139, currency: 'INR', billing_cycle: 'monthly' as const };

describe('studentPlanHint', () => {
  it('shows the student price and yearly saving for the regular plan', () => {
    const hint = studentPlanHint(sub);
    expect(hint?.tier.amount).toBe(69);
    expect(hint?.yearlySaving).toBe(840);
  });

  it('works with aliases and yearly plans', () => {
    expect(studentPlanHint({ ...sub, name: 'youtube', amount: 1490, billing_cycle: 'yearly' })?.tier.amount).toBe(89);
  });

  it('stays quiet on the student plan, shared plans, other currencies and unknown services', () => {
    expect(studentPlanHint({ ...sub, amount: 69 })).toBeNull();
    expect(studentPlanHint({ ...sub, amount: 229 })).toBeNull();
    expect(studentPlanHint({ ...sub, description: 'Spotify Student' })).toBeNull();
    expect(studentPlanHint({ ...sub, currency: 'USD' })).toBeNull();
    expect(studentPlanHint({ ...sub, name: 'Netflix' })).toBeNull();
  });
});
