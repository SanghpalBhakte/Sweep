import {
  Category,
  DashboardStats,
  SpendTrendPoint,
  Subscription,
  TopSubscriptionItem,
  UpcomingPaymentItem,
  ValueRating,
} from '../types';
import { convertCurrency, normalizeMonthlyAmount } from './currency';
import { getDaysUntil, isUpcomingSoon } from './dates';
import { DEFAULT_OFFLINE_RATES } from '../services/exchangeRateService';
import { format, subMonths, startOfMonth, parseISO, isBefore } from 'date-fns';

/**
 * Calculates primary dashboard and overview stats in the preferred display currency.
 * Excludes archived and canceled items from active recurring run-rates.
 */
export function calculateDashboardStats(
  subscriptions: Subscription[],
  targetCurrency: string = 'USD',
  rates: Record<string, number> = DEFAULT_OFFLINE_RATES
): DashboardStats {
  const activeSubs = subscriptions.filter((s) => s.status === 'active');
  const pausedSubs = subscriptions.filter((s) => s.status === 'paused');
  const trialSubs = subscriptions.filter((s) => s.is_trial && s.status === 'active');
  const cancelCandidates = subscriptions.filter(
    (s) => s.value_rating === 'cancel_candidate' && s.status === 'active'
  );

  const monthlyTotal = activeSubs.reduce((acc, sub) => {
    const rawMonthly =
      sub.monthly_amount ||
      normalizeMonthlyAmount(sub.amount, sub.billing_cycle, sub.custom_interval_days);
    const converted = convertCurrency(rawMonthly, sub.currency || 'USD', targetCurrency, rates);
    return acc + converted;
  }, 0);

  const averageMonthlySpend =
    activeSubs.length > 0 ? Math.round((monthlyTotal / activeSubs.length) * 100) / 100 : 0;

  const potentialMonthlySavings = cancelCandidates.reduce((acc, sub) => {
    const rawMonthly =
      sub.monthly_amount ||
      normalizeMonthlyAmount(sub.amount, sub.billing_cycle, sub.custom_interval_days);
    const converted = convertCurrency(rawMonthly, sub.currency || 'USD', targetCurrency, rates);
    return acc + converted;
  }, 0);

  const upcomingRenewalsCount = activeSubs.filter((s) =>
    isUpcomingSoon(s.next_renewal_date, 7)
  ).length;

  // Upcoming 30-day payment pressure in display currency
  const next30DaysPayments = calculateUpcoming30DayCharges(subscriptions, 30, targetCurrency, rates);
  const upcoming30DaysTotal = next30DaysPayments.reduce(
    (acc, item) => acc + item.convertedAmount,
    0
  );

  // Find nearest renewal among active subscriptions
  const sortedActive = [...activeSubs].sort(
    (a, b) => new Date(a.next_renewal_date).getTime() - new Date(b.next_renewal_date).getTime()
  );
  const nextUpcomingRenewal = sortedActive.length > 0 ? sortedActive[0] : null;

  return {
    monthlyTotal: Math.round(monthlyTotal * 100) / 100,
    yearlyProjected: Math.round(monthlyTotal * 12 * 100) / 100,
    averageMonthlySpend,
    activeCount: activeSubs.length,
    pausedCount: pausedSubs.length,
    trialCount: trialSubs.length,
    cancelCandidateCount: cancelCandidates.length,
    potentialMonthlySavings: Math.round(potentialMonthlySavings * 100) / 100,
    upcomingRenewalsCount,
    upcoming30DaysTotal: Math.round(upcoming30DaysTotal * 100) / 100,
    nextUpcomingRenewal,
    displayCurrency: targetCurrency,
  };
}

/**
 * Calculates upcoming billing charges occurring within the next 30 days.
 */
export function calculateUpcoming30DayCharges(
  subscriptions: Subscription[],
  daysWindow: number = 30,
  targetCurrency: string = 'USD',
  rates: Record<string, number> = DEFAULT_OFFLINE_RATES
): UpcomingPaymentItem[] {
  const activeSubs = subscriptions.filter((s) => s.status === 'active');
  const upcoming: UpcomingPaymentItem[] = [];

  activeSubs.forEach((sub) => {
    const daysUntil = getDaysUntil(sub.next_renewal_date);
    if (daysUntil >= 0 && daysUntil <= daysWindow) {
      const converted = convertCurrency(sub.amount, sub.currency || 'USD', targetCurrency, rates);
      upcoming.push({
        subscription: sub,
        renewalDate: sub.next_renewal_date,
        amount: sub.amount,
        convertedAmount: converted,
        daysUntil,
        isUrgent: daysUntil <= 3,
      });
    }
  });

  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
}

/**
 * Returns top cost-driving subscriptions ranked by converted monthly run-rate.
 */
export function calculateTopSubscriptions(
  subscriptions: Subscription[],
  limit: number = 5,
  targetCurrency: string = 'USD',
  rates: Record<string, number> = DEFAULT_OFFLINE_RATES
): TopSubscriptionItem[] {
  const activeSubs = subscriptions.filter((s) => s.status === 'active');

  const items = activeSubs.map((sub) => {
    const rawMonthly =
      sub.monthly_amount ||
      normalizeMonthlyAmount(sub.amount, sub.billing_cycle, sub.custom_interval_days);
    const convertedMonthly = convertCurrency(
      rawMonthly,
      sub.currency || 'USD',
      targetCurrency,
      rates
    );
    return {
      sub,
      rawMonthly,
      convertedMonthly,
    };
  });

  const totalConvertedMonthly = items.reduce((acc, i) => acc + i.convertedMonthly, 0);

  const sorted = items.sort((a, b) => b.convertedMonthly - a.convertedMonthly);

  return sorted.slice(0, limit).map(({ sub, rawMonthly, convertedMonthly }) => {
    const percentageOfTotal =
      totalConvertedMonthly > 0 ? Math.round((convertedMonthly / totalConvertedMonthly) * 100) : 0;

    return {
      subscription: sub,
      monthlyAmount: Math.round(rawMonthly * 100) / 100,
      convertedMonthlyAmount: Math.round(convertedMonthly * 100) / 100,
      percentageOfTotal,
    };
  });
}

/**
 * Calculates a clean monthly spend timeline converted to display currency.
 */
export function calculateSpendTrend(
  subscriptions: Subscription[],
  monthsCount: number = 6,
  targetCurrency: string = 'USD',
  rates: Record<string, number> = DEFAULT_OFFLINE_RATES
): SpendTrendPoint[] {
  const activeSubs = subscriptions.filter((s) => s.status === 'active');
  const points: SpendTrendPoint[] = [];
  const now = new Date();

  for (let i = monthsCount - 1; i >= 0; i--) {
    const targetMonthDate = subMonths(now, i);
    const targetMonthStart = startOfMonth(targetMonthDate);
    const monthLabel = format(targetMonthDate, 'MMM');
    const yearMonth = format(targetMonthDate, 'yyyy-MM');

    // Filter subscriptions that were active on or before this month
    const subsInMonth = activeSubs.filter((sub) => {
      try {
        const startDate = parseISO(sub.start_date);
        return isBefore(startDate, targetMonthStart) || format(startDate, 'yyyy-MM') === yearMonth;
      } catch {
        return true;
      }
    });

    const totalMonthly = subsInMonth.reduce((acc, sub) => {
      const rawMonthly =
        sub.monthly_amount ||
        normalizeMonthlyAmount(sub.amount, sub.billing_cycle, sub.custom_interval_days);
      const converted = convertCurrency(rawMonthly, sub.currency || 'USD', targetCurrency, rates);
      return acc + converted;
    }, 0);

    points.push({
      monthLabel,
      yearMonth,
      totalMonthly: Math.round(totalMonthly * 100) / 100,
      activeCount: subsInMonth.length,
    });
  }

  return points;
}

export interface CategorySpendItem {
  category: Category;
  totalMonthly: number;
  percentage: number;
  count: number;
}

export function calculateCategoryBreakdown(
  subscriptions: Subscription[],
  categories: Category[],
  targetCurrency: string = 'USD',
  rates: Record<string, number> = DEFAULT_OFFLINE_RATES
): CategorySpendItem[] {
  const activeSubs = subscriptions.filter((s) => s.status === 'active');

  const totalMonthly = activeSubs.reduce((acc, sub) => {
    const rawMonthly =
      sub.monthly_amount ||
      normalizeMonthlyAmount(sub.amount, sub.billing_cycle, sub.custom_interval_days);
    return acc + convertCurrency(rawMonthly, sub.currency || 'USD', targetCurrency, rates);
  }, 0);

  if (totalMonthly === 0) return [];

  const categoryMap = new Map<string, { total: number; count: number }>();

  const uncategorizedCat: Category = {
    id: 'uncategorized',
    user_id: null,
    name: 'General & Other',
    slug: 'general-other',
    color: 'stone',
    icon: 'folder',
    created_at: new Date().toISOString(),
  };

  // Subscriptions whose category is missing (or not loaded yet) all share one
  // "uncategorized" bucket so the list never gets two rows with the same id.
  const knownCategoryIds = new Set(categories.map((c) => c.id));

  activeSubs.forEach((sub) => {
    const catId =
      sub.category_id && knownCategoryIds.has(sub.category_id) ? sub.category_id : 'uncategorized';
    const rawMonthly =
      sub.monthly_amount ||
      normalizeMonthlyAmount(sub.amount, sub.billing_cycle, sub.custom_interval_days);
    const converted = convertCurrency(rawMonthly, sub.currency || 'USD', targetCurrency, rates);

    const existing = categoryMap.get(catId) || { total: 0, count: 0 };
    categoryMap.set(catId, {
      total: existing.total + converted,
      count: existing.count + 1,
    });
  });

  const results: CategorySpendItem[] = [];

  categoryMap.forEach((data, catId) => {
    const category =
      catId === 'uncategorized'
        ? uncategorizedCat
        : categories.find((c) => c.id === catId) || uncategorizedCat;

    results.push({
      category,
      totalMonthly: Math.round(data.total * 100) / 100,
      percentage: Math.round((data.total / totalMonthly) * 100),
      count: data.count,
    });
  });

  return results.sort((a, b) => b.totalMonthly - a.totalMonthly);
}

export interface ValueRatingBreakdown {
  rating: ValueRating;
  label: string;
  totalMonthly: number;
  count: number;
  percentage: number;
}

export function calculateValueRatingBreakdown(
  subscriptions: Subscription[],
  targetCurrency: string = 'USD',
  rates: Record<string, number> = DEFAULT_OFFLINE_RATES
): ValueRatingBreakdown[] {
  const activeSubs = subscriptions.filter((s) => s.status === 'active');

  const totalMonthly = activeSubs.reduce((acc, sub) => {
    const rawMonthly =
      sub.monthly_amount ||
      normalizeMonthlyAmount(sub.amount, sub.billing_cycle, sub.custom_interval_days);
    return acc + convertCurrency(rawMonthly, sub.currency || 'USD', targetCurrency, rates);
  }, 0);

  const ratings: { rating: ValueRating; label: string }[] = [
    { rating: 'essential', label: 'Essential' },
    { rating: 'useful', label: 'Useful' },
    { rating: 'rarely_used', label: 'Rarely Used' },
    { rating: 'cancel_candidate', label: 'Cancel Candidates' },
  ];

  return ratings.map((r) => {
    const subs = activeSubs.filter((s) => s.value_rating === r.rating);
    const monthly = subs.reduce((acc, s) => {
      const rawMonthly =
        s.monthly_amount ||
        normalizeMonthlyAmount(s.amount, s.billing_cycle, s.custom_interval_days);
      return acc + convertCurrency(rawMonthly, s.currency || 'USD', targetCurrency, rates);
    }, 0);

    return {
      rating: r.rating,
      label: r.label,
      totalMonthly: Math.round(monthly * 100) / 100,
      count: subs.length,
      percentage: totalMonthly > 0 ? Math.round((monthly / totalMonthly) * 100) : 0,
    };
  });
}
