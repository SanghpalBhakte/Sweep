import { BillingCycle } from '../types';
import { DEFAULT_OFFLINE_RATES, exchangeRateService } from '../services/exchangeRateService';

export const SUPPORTED_CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
];

/**
 * Format a number into clean, human currency display
 */
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  options: { showCents?: boolean; compact?: boolean } = {}
): string {
  const { showCents = true, compact = false } = options;
  const curr = (currency || 'USD').toUpperCase().trim();
  // Digit grouping is locale-specific (e.g. India groups as 1,23,456 not 123,456) - 'en-US'
  // alone renders every currency with Western thousands grouping, which is wrong for INR.
  const locale = curr === 'INR' ? 'en-IN' : 'en-US';

  // Special rounding for zero-decimal currencies like JPY / KRW
  const isZeroDecimal = ['JPY', 'KRW'].includes(curr);

  // Handle compact formatting for large numbers if needed
  if (compact && amount >= 1000) {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: curr,
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(amount);
    } catch {
      return `${curr} ${amount >= 1000 ? `${(amount / 1000).toFixed(1)}k` : amount.toFixed(0)}`;
    }
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: isZeroDecimal ? 0 : showCents && amount % 1 !== 0 ? 2 : amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: isZeroDecimal ? 0 : 2,
    }).format(amount);
  } catch {
    return `${curr} ${amount.toFixed(isZeroDecimal ? 0 : 2)}`;
  }
}

/**
 * Converts amount from one currency to another using the exchange rates table
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string = 'USD',
  toCurrency: string = 'USD',
  rates: Record<string, number> = DEFAULT_OFFLINE_RATES
): number {
  return exchangeRateService.convert(amount, fromCurrency, toCurrency, rates);
}

/**
 * Calculate normalized monthly amount from any billing cycle
 */
export function normalizeMonthlyAmount(
  amount: number,
  cycle: BillingCycle,
  customDays?: number
): number {
  if (amount <= 0) return 0;

  switch (cycle) {
    case 'monthly':
      return amount;
    case 'quarterly':
      return amount / 3;
    case 'yearly':
      return amount / 12;
    case 'custom':
      if (!customDays || customDays <= 0) return amount;
      return (amount / customDays) * 30.4375; // average days per month
    default:
      return amount;
  }
}

/**
 * Format billing cycle label for concise UI display
 */
export function formatCycle(cycle: BillingCycle, customDays?: number): string {
  switch (cycle) {
    case 'monthly':
      return '/mo';
    case 'quarterly':
      return '/qtr';
    case 'yearly':
      return '/yr';
    case 'custom':
      return `/${customDays || 30}d`;
    default:
      return '';
  }
}

/**
 * Format billing cycle into full readable name
 */
export function formatCycleFull(cycle: BillingCycle, customDays?: number): string {
  switch (cycle) {
    case 'monthly':
      return 'Billed monthly';
    case 'quarterly':
      return 'Billed every 3 months';
    case 'yearly':
      return 'Billed annually';
    case 'custom':
      return `Billed every ${customDays || 30} days`;
    default:
      return 'Recurring';
  }
}
