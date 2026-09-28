export type SubscriptionStatus = 'active' | 'paused' | 'canceled' | 'archived';

export type BillingCycle = 'monthly' | 'quarterly' | 'yearly' | 'custom';

export type ValueRating = 'essential' | 'useful' | 'rarely_used' | 'cancel_candidate';

export type PaymentMethodType =
  | 'card'
  | 'upi'
  | 'bank'
  | 'wallet'
  | 'credit_card'
  | 'debit_card'
  | 'bank_account'
  | 'paypal'
  | 'apple_pay'
  | 'other'
  | string;

export type BrowserNotificationStatus = 'default' | 'granted' | 'denied' | 'unsupported';

export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  currency_preference: string;
  theme_preference: 'paper-ledger' | 'night-shelf' | 'system';
  default_reminder_days: number[];
  annual_benchmark_percent?: number;
  category_annual_benchmarks?: Record<string, number>; // map category_id -> benchmark percentage
  notifications_enabled?: boolean;
  notify_renewals?: boolean;
  notify_trials?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  slug: string;
  slug_aliases?: string[];
  color: string;
  icon: string;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  user_id: string;
  name: string;
  type: string;
  last4?: string | null;
  color?: string | null;
  is_default: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  billing_cycle: BillingCycle;
  custom_interval_days?: number;
  status: SubscriptionStatus;
  category_id?: string | null;
  payment_method_id?: string | null;
  start_date: string; // ISO date string (YYYY-MM-DD)
  next_renewal_date: string; // ISO date string (YYYY-MM-DD)
  is_trial: boolean;
  trial_end_date?: string | null; // ISO date string (YYYY-MM-DD)
  reminder_offsets: number[]; // e.g. [7, 3, 1]
  value_rating: ValueRating;
  cancel_url?: string;
  notes?: string;
  monthly_amount: number; // normalized monthly amount
  monthly_alternative_price?: number | null; // optional monthly plan price for annual arbitrage comparison
  
  // Price-Hike & Cancellation Tracking
  previous_amount?: number | null; // previous price before recorded increase
  price_hike_reviewed_at?: string | null; // timestamp when user acknowledged price change
  cancellation_reason?: CancellationReason | null; // structured cancellation reason
  cancellation_notes?: string | null;
  cancellation_effective_date?: string | null;

  created_at: string;
  updated_at: string;
  
  // Expanded relations (optional, when joined)
  category?: Category;
  payment_method?: PaymentMethod;
}

export type CancellationReason =
  | 'too_expensive'
  | 'not_using_enough'
  | 'temporary_pause'
  | 'switching_service'
  | 'duplicate_overlap'
  | 'missing_value'
  | 'other';

export interface PriceHikeAlert {
  id: string;
  subscriptionId: string;
  subscriptionName: string;
  currentAmount: number;
  previousAmount: number;
  currency: string;
  billingCycle: BillingCycle;
  monthlyDelta: number;
  percentageIncrease: number;
  nextRenewalDate: string;
  whyExplanation: string;
  heuristicRule: string;
  isReviewed: boolean;
  reviewedAt?: string | null;
}

export interface Reminder {
  id: string;
  user_id: string;
  subscription_id: string;
  reminder_date: string;
  offset_days: number;
  type: 'renewal' | 'trial_expiry';
  is_dismissed: boolean;
  sent_at?: string | null;
  created_at: string;
  subscription?: Subscription;
}

export type AlertSeverity = 'urgent' | 'warning' | 'info';
export type AlertType = 'renewal_today' | 'renewal_upcoming' | 'trial_ending' | 'renewal_overdue';

export interface AppAlert {
  id: string;
  subscriptionId: string;
  subscriptionName: string;
  type: AlertType;
  title: string;
  message: string;
  targetDate: string;
  daysUntil: number;
  amount: number;
  currency: string;
  severity: AlertSeverity;
  cancelUrl?: string;
  isTrial: boolean;
  status: SubscriptionStatus;
}

export interface NotificationPreferences {
  enabled: boolean;
  notifyRenewals: boolean;
  notifyTrials: boolean;
  offsets: number[];
}

export interface SubscriptionEvent {
  id: string;
  user_id: string;
  subscription_id: string;
  event_type:
    | 'created'
    | 'renewed'
    | 'price_changed'
    | 'cycle_changed'
    | 'status_changed'
    | 'trial_converted'
    | 'canceled';
  previous_amount?: number;
  new_amount?: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface DashboardStats {
  monthlyTotal: number;
  yearlyProjected: number;
  averageMonthlySpend: number;
  activeCount: number;
  pausedCount: number;
  trialCount: number;
  cancelCandidateCount: number;
  overdueCount: number;
  potentialMonthlySavings: number;
  upcomingRenewalsCount: number;
  upcoming30DaysTotal: number;
  nextUpcomingRenewal: Subscription | null;
  displayCurrency: string;
}

export interface SpendTrendPoint {
  monthLabel: string;
  yearMonth: string;
  totalMonthly: number;
  activeCount: number;
}

export interface TopSubscriptionItem {
  subscription: Subscription;
  monthlyAmount: number;
  convertedMonthlyAmount: number;
  percentageOfTotal: number;
}

export interface UpcomingPaymentItem {
  subscription: Subscription;
  renewalDate: string;
  amount: number;
  convertedAmount: number;
  daysUntil: number;
  isUrgent: boolean;
}

export interface SubscriptionFilters {
  search?: string;
  status?: SubscriptionStatus | 'all';
  category_id?: string | 'all';
  value_rating?: ValueRating | 'all';
  billing_cycle?: BillingCycle | 'all';
  sortBy?: 'next_renewal_date' | 'amount' | 'name' | 'monthly_amount';
  sortOrder?: 'asc' | 'desc';
}

export type SubscriptionFormData = Omit<
  Subscription,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'monthly_amount' | 'category' | 'payment_method'
>;

// -----------------------------------------------------------------------------
// Annual Contract Optimization Models
// -----------------------------------------------------------------------------

export type AnnualInsightType =
  | 'annual_cheaper'
  | 'monthly_cheaper'
  | 'equal_price'
  | 'missing_monthly_price';

export interface AnnualComparisonResult {
  subscription: Subscription;
  annualAmount: number;
  effectiveMonthlyRate: number;
  monthlyAlternativePrice: number | null;
  yearlyAtMonthlyRate: number | null;
  annualSavingsAmount: number | null;
  savingsPercent: number | null;
  monthsFreeEquivalent: number | null;
  insightType: AnnualInsightType;
  daysUntilRenewal: number;
  isWithinReviewWindow: boolean;
}

// -----------------------------------------------------------------------------
// CSV & PDF Import Models
// -----------------------------------------------------------------------------

export interface NormalizedTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  rawDescription: string;
  cleanMerchant: string;
  amount: number; // positive debit/charge amount
}

export interface RecurringCandidate {
  id: string;
  merchantName: string;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  frequencyDays: number;
  confidence: 'high' | 'medium' | 'low';
  transactionCount: number;
  firstDate: string;
  lastDate: string;
  estimatedNextRenewal: string;
  matchedTransactions: NormalizedTransaction[];
  suggestedCategoryId?: string | null;
  valueRating: ValueRating;
  selected: boolean;
}

export interface CsvColumnMapping {
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string;
  debitColumn?: string;
  creditColumn?: string;
}

// -----------------------------------------------------------------------------
// Data Export & Backup Models
// -----------------------------------------------------------------------------

export interface ExportedSubscription
  extends Omit<Subscription, 'id' | 'user_id' | 'created_at' | 'updated_at'> {
  category_slug?: string;
}

export interface SiftBackupData {
  version: '1.0';
  app: 'Sweep' | 'Sift';
  exported_at: string;
  user_email: string;
  profile: Partial<Profile>;
  subscriptions: ExportedSubscription[];
  categories: Category[];
  payment_methods: PaymentMethod[];
}

export type SweepBackupData = SiftBackupData;

export interface BackupValidationResult {
  valid: boolean;
  error?: string;
  data?: SiftBackupData;
  counts?: {
    subscriptions: number;
    categories: number;
    paymentMethods: number;
  };
}

// -----------------------------------------------------------------------------
// Multi-Currency & Exchange Rate Models
// -----------------------------------------------------------------------------

export interface ExchangeRatesData {
  base: string; // e.g. 'USD'
  rates: Record<string, number>;
  updatedAt: string;
  source: string;
  isStale?: boolean;
}
