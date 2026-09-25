import { Category, PaymentMethod, Profile, Subscription } from '../types';
import { normalizeMonthlyAmount } from '../utils/currency';

export const defaultProfile: Profile = {
  id: '00000000-0000-0000-0000-000000000001',
  email: '',
  full_name: '',
  currency_preference: 'USD',
  theme_preference: 'paper-ledger',
  default_reminder_days: [7, 3, 1],
  annual_benchmark_percent: 16.7,
  category_annual_benchmarks: {},
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

export const mockCategories: Category[] = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    user_id: null,
    name: 'Software & Development',
    slug: 'software-dev',
    color: 'moss',
    icon: 'terminal',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '10000000-0000-0000-0000-000000000002',
    user_id: null,
    name: 'Infrastructure & Cloud',
    slug: 'infra-cloud',
    color: 'slate',
    icon: 'server',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '10000000-0000-0000-0000-000000000003',
    user_id: null,
    name: 'Productivity & Notes',
    slug: 'productivity',
    color: 'ochre',
    icon: 'edit-3',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '10000000-0000-0000-0000-000000000004',
    user_id: null,
    name: 'Media & Reading',
    slug: 'media-reading',
    color: 'terracotta',
    icon: 'book-open',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '10000000-0000-0000-0000-000000000005',
    user_id: null,
    name: 'Health & Routine',
    slug: 'health-routine',
    color: 'sage',
    icon: 'heart',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '10000000-0000-0000-0000-000000000006',
    user_id: null,
    name: 'Utilities & Sync',
    slug: 'utilities-sync',
    color: 'stone',
    icon: 'home',
    created_at: '2024-01-01T00:00:00Z',
  },
];

export const mockPaymentMethods: PaymentMethod[] = [];

const today = new Date();
const addDaysISO = (days: number): string => {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

// Curated starter templates for demo / quick testing
export const mockSubscriptions: Subscription[] = [
  {
    id: 'sub-sample-01',
    user_id: '00000000-0000-0000-0000-000000000001',
    name: 'Cursor Pro',
    description: 'AI code editor subscription for development',
    amount: 20.0,
    currency: 'USD',
    billing_cycle: 'monthly',
    status: 'active',
    category_id: '10000000-0000-0000-0000-000000000001',
    payment_method_id: '20000000-0000-0000-0000-000000000001',
    start_date: '2024-03-01',
    next_renewal_date: addDaysISO(2), // 2 days from today
    is_trial: false,
    trial_end_date: null,
    reminder_offsets: [3, 1],
    value_rating: 'essential',
    cancel_url: 'https://cursor.com/settings',
    notes: 'Daily driver for all coding projects.',
    monthly_amount: 20.0,
    created_at: '2024-03-01T00:00:00Z',
    updated_at: '2024-03-01T00:00:00Z',
    category: mockCategories[0],
    payment_method: mockPaymentMethods[0],
  },
  {
    id: 'sub-sample-02',
    user_id: '00000000-0000-0000-0000-000000000001',
    name: 'Fastmail Standard',
    description: 'Privacy-focused email and custom domain routing',
    amount: 60.0,
    currency: 'USD',
    billing_cycle: 'yearly',
    status: 'active',
    category_id: '10000000-0000-0000-0000-000000000006',
    payment_method_id: '20000000-0000-0000-0000-000000000001',
    start_date: '2023-11-15',
    next_renewal_date: addDaysISO(18),
    is_trial: false,
    trial_end_date: null,
    reminder_offsets: [7, 3],
    value_rating: 'essential',
    cancel_url: 'https://www.fastmail.com/settings/billing',
    notes: 'Handles personal domains and aliases.',
    monthly_amount: normalizeMonthlyAmount(60.0, 'yearly'),
    monthly_alternative_price: 6.0,
    created_at: '2023-11-15T00:00:00Z',
    updated_at: '2023-11-15T00:00:00Z',
    category: mockCategories[5],
    payment_method: mockPaymentMethods[0],
  },
  {
    id: 'sub-sample-03',
    user_id: '00000000-0000-0000-0000-000000000001',
    name: 'Readwise Reader (Trial)',
    description: 'Read-it-later and highlights sync for books and articles',
    amount: 9.99,
    currency: 'USD',
    billing_cycle: 'monthly',
    status: 'active',
    category_id: '10000000-0000-0000-0000-000000000004',
    payment_method_id: '20000000-0000-0000-0000-000000000001',
    start_date: addDaysISO(-25),
    next_renewal_date: addDaysISO(5),
    is_trial: true,
    trial_end_date: addDaysISO(5), // Trial ending in 5 days
    reminder_offsets: [3, 1],
    value_rating: 'cancel_candidate',
    cancel_url: 'https://readwise.io/access/billing',
    notes: 'Evaluate trial before auto-conversion.',
    monthly_amount: 9.99,
    created_at: '2024-08-01T00:00:00Z',
    updated_at: '2024-08-01T00:00:00Z',
    category: mockCategories[3],
    payment_method: mockPaymentMethods[0],
  },
];
