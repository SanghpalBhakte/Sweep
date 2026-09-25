import {
  Category,
  DashboardStats,
  PaymentMethod,
  Profile,
  Subscription,
  SubscriptionFilters,
  SubscriptionFormData,
} from '../types';
import { defaultProfile, mockCategories, mockSubscriptions } from '../mock/sampleData';
import { CANONICAL_CATEGORIES } from '../constants/categories';
import {
  buildSubscriptionInsertPayload,
  buildSubscriptionUpdatePayload,
} from './subscriptionPayloadBuilder';
import { createClient } from '../supabase/client';
import { calculateDashboardStats } from '../utils/analytics';
import { normalizeMonthlyAmount } from '../utils/currency';
import { resolveCategoryDefaultColor } from '../utils/backup';

const STORAGE_KEYS = {
  SUBSCRIPTIONS: 'sweep_subscriptions_v1',
  CATEGORIES: 'sweep_categories_v1',
  PAYMENT_METHODS: 'sweep_payment_methods_v1',
  PROFILE: 'sweep_profile_v1',
};

const LEGACY_STORAGE_KEYS = {
  SUBSCRIPTIONS: 'sift_subscriptions_v1',
  CATEGORIES: 'sift_categories_v1',
  PAYMENT_METHODS: 'sift_payment_methods_v1',
  PROFILE: 'sift_profile_v1',
};

class SubscriptionService {
  private getLocalData<T>(key: string, fallback: T, legacyKey?: string): T {
    if (typeof window === 'undefined') return fallback;
    try {
      const saved =
        localStorage.getItem(key) || (legacyKey ? localStorage.getItem(legacyKey) : null);
      return saved ? JSON.parse(saved) : fallback;
    } catch {
      return fallback;
    }
  }

  private setLocalData<T>(key: string, data: T): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      console.error('Failed to save to local storage', err);
    }
  }

  private async getAuthUser(supabase: ReturnType<typeof createClient>) {
    if (!supabase) return null;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) return session.user;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user;
    } catch {
      return null;
    }
  }

  // --- Subscriptions ---

  async getSubscriptions(filters?: SubscriptionFilters): Promise<Subscription[]> {
    const supabase = createClient();
    let items: Subscription[] = [];

    if (supabase) {
      try {
        const user = await this.getAuthUser(supabase);

        if (user) {
          let query = (supabase.from('subscriptions') as any)
            .select('*, category:categories(*), payment_method:payment_methods(*)')
            .eq('user_id', user.id);

          if (filters?.status && filters.status !== 'all') {
            query = query.eq('status', filters.status);
          }
          if (filters?.category_id && filters.category_id !== 'all') {
            query = query.eq('category_id', filters.category_id);
          }
          if (filters?.value_rating && filters.value_rating !== 'all') {
            query = query.eq('value_rating', filters.value_rating);
          }

          const { data, error } = await query;
          if (!error && data) {
            items = data as unknown as Subscription[];
            this.setLocalData(STORAGE_KEYS.SUBSCRIPTIONS, items);
          } else {
            console.error('Supabase query error:', error);
            items = this.getLocalData(
              STORAGE_KEYS.SUBSCRIPTIONS,
              [],
              LEGACY_STORAGE_KEYS.SUBSCRIPTIONS
            );
          }
        } else {
          // Unauthenticated / offline local mode
          items = this.getLocalData(
            STORAGE_KEYS.SUBSCRIPTIONS,
            [],
            LEGACY_STORAGE_KEYS.SUBSCRIPTIONS
          );
        }
      } catch (err) {
        console.error('Error fetching subscriptions from Supabase:', err);
        items = this.getLocalData(
          STORAGE_KEYS.SUBSCRIPTIONS,
          [],
          LEGACY_STORAGE_KEYS.SUBSCRIPTIONS
        );
      }
    } else {
      items = this.getLocalData(
        STORAGE_KEYS.SUBSCRIPTIONS,
        [],
        LEGACY_STORAGE_KEYS.SUBSCRIPTIONS
      );
    }

    // Apply in-memory search
    if (filters?.search && filters.search.trim() !== '') {
      const q = filters.search.toLowerCase().trim();
      items = items.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description && s.description.toLowerCase().includes(q)) ||
          (s.category && s.category.name.toLowerCase().includes(q)) ||
          (s.notes && s.notes.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (filters?.status && filters.status !== 'all') {
      items = items.filter((s) => s.status === filters.status);
    }

    // Category filter
    if (filters?.category_id && filters.category_id !== 'all') {
      items = items.filter((s) => s.category_id === filters.category_id);
    }

    // Value rating filter
    if (filters?.value_rating && filters.value_rating !== 'all') {
      items = items.filter((s) => s.value_rating === filters.value_rating);
    }

    // Billing cycle filter
    if (filters?.billing_cycle && filters.billing_cycle !== 'all') {
      items = items.filter((s) => s.billing_cycle === filters.billing_cycle);
    }

    // Sorting
    const sortBy = filters?.sortBy || 'next_renewal_date';
    const sortOrder = filters?.sortOrder || 'asc';

    items.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'next_renewal_date') {
        comparison =
          new Date(a.next_renewal_date).getTime() - new Date(b.next_renewal_date).getTime();
      } else if (sortBy === 'amount') {
        comparison = a.amount - b.amount;
      } else if (sortBy === 'monthly_amount') {
        comparison = a.monthly_amount - b.monthly_amount;
      } else if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return items;
  }

  async getSubscriptionById(id: string): Promise<Subscription | null> {
    const supabase = createClient();
    const user = supabase ? await this.getAuthUser(supabase) : null;
    if (supabase && user) {
      try {
        const { data, error } = await (supabase.from('subscriptions') as any)
          .select('*, category:categories(*), payment_method:payment_methods(*)')
          .eq('id', id)
          .single();

        if (!error && data) {
          return data as unknown as Subscription;
        }
      } catch {
        // Fallback
      }
    }

    const subs = await this.getSubscriptions();
    return subs.find((s) => s.id === id) || null;
  }

  async createSubscription(form: SubscriptionFormData): Promise<Subscription> {
    const supabase = createClient();
    const monthlyAmount = normalizeMonthlyAmount(
      form.amount,
      form.billing_cycle,
      form.custom_interval_days
    );

    let userId = defaultProfile.id;

    if (supabase) {
      const user = await this.getAuthUser(supabase);

      if (user) {
        userId = user.id;

        // Build typed insert payload matching production database schema strictly
        const insertPayload = buildSubscriptionInsertPayload(userId, form);

        // Foreign key check: verify category_id exists in DB table to prevent FK violations
        if (insertPayload.category_id) {
          const { data: catExists } = await (supabase.from('categories') as any)
            .select('id')
            .eq('id', insertPayload.category_id)
            .maybeSingle();

          if (!catExists) {
            const canon = CANONICAL_CATEGORIES.find((c) => c.id === insertPayload.category_id);
            if (canon) {
              const { data: createdCat } = await (supabase.from('categories') as any)
                .insert({
                  id: canon.id,
                  user_id: user.id,
                  name: canon.name,
                  slug: canon.slug,
                  color: canon.color,
                  icon: canon.icon,
                })
                .select('id')
                .maybeSingle();

              if (!createdCat) {
                insertPayload.category_id = null;
              }
            } else {
              insertPayload.category_id = null;
            }
          }
        }

        // Foreign key check: verify payment_method_id exists in DB table to prevent FK violations
        if (insertPayload.payment_method_id) {
          const { data: pmExists } = await (supabase.from('payment_methods') as any)
            .select('id')
            .eq('id', insertPayload.payment_method_id)
            .maybeSingle();
          if (!pmExists) {
            insertPayload.payment_method_id = null;
          }
        }

        const insertRes = await (supabase.from('subscriptions') as any)
          .insert(insertPayload)
          .select('*, category:categories(*), payment_method:payment_methods(*)')
          .single();

        if (insertRes.error) {
          console.error('Supabase subscription insert error:', {
            code: insertRes.error.code,
            message: insertRes.error.message,
            details: insertRes.error.details,
            hint: insertRes.error.hint,
            operation: 'createSubscription',
          });
          throw new Error(insertRes.error.message || 'Failed to save subscription.');
        }

        if (insertRes.data) {
          const created = insertRes.data as unknown as Subscription;
          // Synchronize local cache with newly persisted record
          const all = this.getLocalData(STORAGE_KEYS.SUBSCRIPTIONS, [] as Subscription[]);
          const updated = [created, ...all.filter((s) => s.id !== created.id)];
          this.setLocalData(STORAGE_KEYS.SUBSCRIPTIONS, updated);
          return created;
        }
      }
    }

    // Local storage fallback for unauthenticated / offline mode
    const newSub: Subscription = {
      ...form,
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `sub-${Date.now()}`,
      user_id: userId,
      monthly_amount: monthlyAmount,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const all = this.getLocalData(STORAGE_KEYS.SUBSCRIPTIONS, mockSubscriptions);
    const updated = [newSub, ...all];
    this.setLocalData(STORAGE_KEYS.SUBSCRIPTIONS, updated);
    return newSub;
  }

  async updateSubscription(
    id: string,
    updates: Partial<SubscriptionFormData>
  ): Promise<Subscription> {
    const supabase = createClient();
    const existing = await this.getSubscriptionById(id);
    if (!existing) throw new Error('Subscription not found');

    const billingCycle = updates.billing_cycle || existing.billing_cycle;
    const amount = updates.amount !== undefined ? Number(updates.amount) : existing.amount;
    const customDays =
      updates.custom_interval_days !== undefined
        ? updates.custom_interval_days
        : existing.custom_interval_days;
    const monthlyAmount = normalizeMonthlyAmount(amount, billingCycle, customDays);

    const updatedSub: Subscription = {
      ...existing,
      ...updates,
      monthly_amount: monthlyAmount,
      updated_at: new Date().toISOString(),
    };

    const user = supabase ? await this.getAuthUser(supabase) : null;

    if (supabase && user) {
      const updatePayload = buildSubscriptionUpdatePayload(existing, updates);

      // Foreign key check: verify category_id exists in DB table
      if (updatePayload.category_id) {
        const { data: catExists } = await (supabase.from('categories') as any)
          .select('id')
          .eq('id', updatePayload.category_id)
          .maybeSingle();

        if (!catExists) {
          const canon = CANONICAL_CATEGORIES.find((c) => c.id === updatePayload.category_id);
          if (canon) {
            const { data: createdCat } = await (supabase.from('categories') as any)
              .insert({
                id: canon.id,
                user_id: user.id,
                name: canon.name,
                slug: canon.slug,
                color: canon.color,
                icon: canon.icon,
              })
              .select('id')
              .maybeSingle();

            if (!createdCat) {
              updatePayload.category_id = null;
            }
          } else {
            updatePayload.category_id = null;
          }
        }
      }

      // Foreign key check: verify payment_method_id exists in DB table
      if (updatePayload.payment_method_id) {
        const { data: pmExists } = await (supabase.from('payment_methods') as any)
          .select('id')
          .eq('id', updatePayload.payment_method_id)
          .maybeSingle();
        if (!pmExists) {
          updatePayload.payment_method_id = null;
        }
      }

      const updateRes = await (supabase.from('subscriptions') as any)
        .update(updatePayload)
        .eq('id', id)
        .select('*, category:categories(*), payment_method:payment_methods(*)')
        .single();

      if (updateRes.error) {
        console.error('Supabase subscription update error:', {
          code: updateRes.error.code,
          message: updateRes.error.message,
          details: updateRes.error.details,
          hint: updateRes.error.hint,
          operation: 'updateSubscription',
        });
        throw new Error(updateRes.error.message || 'Failed to update subscription.');
      }

      if (updateRes.data) {
        const persisted = updateRes.data as unknown as Subscription;
        const all = this.getLocalData(STORAGE_KEYS.SUBSCRIPTIONS, [] as Subscription[]);
        const updatedList = all.map((s) => (s.id === id ? persisted : s));
        this.setLocalData(STORAGE_KEYS.SUBSCRIPTIONS, updatedList);
        return persisted;
      }
    }

    const all = this.getLocalData(STORAGE_KEYS.SUBSCRIPTIONS, mockSubscriptions);
    const updatedList = all.map((s) => (s.id === id ? updatedSub : s));
    this.setLocalData(STORAGE_KEYS.SUBSCRIPTIONS, updatedList);

    return updatedSub;
  }

  async deleteSubscription(id: string): Promise<void> {
    const supabase = createClient();
    const user = supabase ? await this.getAuthUser(supabase) : null;
    if (supabase && user) {
      const { error } = await (supabase.from('subscriptions') as any).delete().eq('id', id);
      if (error) {
        console.error('Supabase subscription delete error:', error);
        throw new Error(error.message || 'Failed to delete subscription.');
      }
    }

    const all = this.getLocalData(STORAGE_KEYS.SUBSCRIPTIONS, mockSubscriptions);
    const updated = all.filter((s) => s.id !== id);
    this.setLocalData(STORAGE_KEYS.SUBSCRIPTIONS, updated);
  }

  // --- Categories & Payment Methods ---

  async getCategories(): Promise<Category[]> {
    const supabase = createClient();
    // Guests keep their categories in local storage. Asking Supabase without a session
    // returns an empty list, which used to wipe the guest's own categories.
    const user = supabase ? await this.getAuthUser(supabase) : null;

    if (supabase && user) {
      try {
        const { data, error } = await (supabase.from('categories') as any)
          .select('id, user_id, name, slug, color, icon, created_at')
          .order('name', { ascending: true });

        if (!error && data) {
          const dbCategories = data as Category[];
          const dbSlugs = new Set(dbCategories.map((c) => c.slug));
          const dbIds = new Set(dbCategories.map((c) => c.id));
          const merged = [...dbCategories];
          for (const canon of CANONICAL_CATEGORIES) {
            if (!dbSlugs.has(canon.slug) && !dbIds.has(canon.id)) {
              merged.push(canon);
            }
          }
          const sorted = merged.sort((a, b) => a.name.localeCompare(b.name));
          this.setLocalData(STORAGE_KEYS.CATEGORIES, sorted);
          return sorted;
        }
      } catch (err) {
        console.warn('Error querying categories from Supabase:', err);
      }
    }

    const cached = this.getLocalData(STORAGE_KEYS.CATEGORIES, CANONICAL_CATEGORIES);
    if (cached && cached.length > 0) {
      return cached;
    }

    return CANONICAL_CATEGORIES;
  }

  async createCategory(categoryData: {
    name: string;
    slug?: string;
    color?: string;
    icon?: string;
  }): Promise<Category> {
    const slug =
      categoryData.slug?.trim().toLowerCase() ||
      categoryData.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    const newCat: Category = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `cat-${Date.now()}`,
      user_id: null,
      name: categoryData.name.trim(),
      slug,
      color: resolveCategoryDefaultColor(categoryData.color, categoryData.name || slug),
      icon: categoryData.icon || 'folder',
      created_at: new Date().toISOString(),
    };

    const supabase = createClient();
    if (supabase) {
      try {
        const user = await this.getAuthUser(supabase);
        if (user) {
          const { data, error } = await (supabase.from('categories') as any)
            .insert({
              user_id: user.id,
              name: newCat.name,
              slug: newCat.slug,
              color: newCat.color,
              icon: newCat.icon,
            })
            .select()
            .single();

          if (!error && data) {
            const inserted = data as Category;
            const all = this.getLocalData(STORAGE_KEYS.CATEGORIES, [] as Category[]);
            const updated = [inserted, ...all.filter((c) => c.id !== inserted.id)];
            this.setLocalData(STORAGE_KEYS.CATEGORIES, updated);
            return inserted;
          }
          if (error) {
            console.error('Supabase createCategory error:', error);
          }
        }
      } catch (err) {
        console.warn('Failed to insert category into Supabase, using local storage fallback:', err);
      }
    }

    const all = this.getLocalData(STORAGE_KEYS.CATEGORIES, CANONICAL_CATEGORIES);
    const updated = [...all, newCat];
    this.setLocalData(STORAGE_KEYS.CATEGORIES, updated);
    return newCat;
  }

  async updateCategory(
    id: string,
    updates: Partial<{ name: string; slug: string; color: string; icon: string }>
  ): Promise<Category> {
    const categories = await this.getCategories();
    const existing = categories.find((c) => c.id === id);
    if (!existing) throw new Error('Category not found');

    const newSlug = updates.slug || updates.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || existing.slug;
    const updatedAliases = existing.slug_aliases ? [...existing.slug_aliases] : [];
    if (newSlug !== existing.slug && !updatedAliases.includes(existing.slug)) {
      updatedAliases.push(existing.slug);
    }

    const updatedCat: Category = {
      ...existing,
      ...updates,
      slug: newSlug,
      slug_aliases: updatedAliases,
    };

    const supabase = createClient();
    const user = supabase ? await this.getAuthUser(supabase) : null;
    if (supabase && user) {
      try {
        await (supabase.from('categories') as any)
          .update({
            name: updatedCat.name,
            slug: updatedCat.slug,
            color: updatedCat.color,
            icon: updatedCat.icon,
          })
          .eq('id', id);
      } catch (err) {
        console.warn('Failed to update category in Supabase, using local storage fallback:', err);
      }
    }

    const all = this.getLocalData(STORAGE_KEYS.CATEGORIES, CANONICAL_CATEGORIES);
    const updatedList = all.map((c) => (c.id === id ? updatedCat : c));
    this.setLocalData(STORAGE_KEYS.CATEGORIES, updatedList);
    return updatedCat;
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const supabase = createClient();
    const user = supabase ? await this.getAuthUser(supabase) : null;

    if (supabase && user) {
      try {
        const { data, error } = await (supabase.from('payment_methods') as any)
          .select('id, user_id, name, type, last4, color, is_default, created_at')
          .order('is_default', { ascending: false })
          .order('name', { ascending: true });

        if (!error && data) {
          const dbPaymentMethods = data as PaymentMethod[];
          this.setLocalData(STORAGE_KEYS.PAYMENT_METHODS, dbPaymentMethods);
          return dbPaymentMethods;
        }
      } catch (err) {
        console.warn('Error querying payment methods from Supabase:', err);
      }
    }

    const cached = this.getLocalData(STORAGE_KEYS.PAYMENT_METHODS, [] as PaymentMethod[]);
    return cached;
  }

  private normalizePaymentMethodType(raw?: string | null): string {
    if (!raw) return 'credit_card';
    const t = raw.toLowerCase().trim();
    if (t === 'credit_card' || t === 'card') return 'credit_card';
    if (t === 'debit_card') return 'debit_card';
    if (t === 'bank_account' || t === 'bank') return 'bank_account';
    if (t === 'paypal') return 'paypal';
    if (t === 'apple_pay') return 'apple_pay';
    return 'other';
  }

  async createPaymentMethod(data: {
    name: string;
    type: string;
    last4?: string | null;
    color?: string | null;
    is_default?: boolean;
  }): Promise<PaymentMethod> {
    const supabase = createClient();
    let userId = defaultProfile.id;

    if (supabase) {
      try {
        const user = await this.getAuthUser(supabase);
        if (user) {
          userId = user.id;
          const normalizedType = this.normalizePaymentMethodType(data.type);
          const { data: created, error } = await (supabase.from('payment_methods') as any)
            .insert({
              user_id: user.id,
              name: data.name.trim(),
              type: normalizedType,
              last4: data.last4?.trim() || null,
              color: data.color?.trim() || null,
              is_default: Boolean(data.is_default),
            })
            .select()
            .single();

          if (!error && created) {
            const newPm = created as PaymentMethod;
            const all = this.getLocalData(STORAGE_KEYS.PAYMENT_METHODS, [] as PaymentMethod[]);
            const updated = [newPm, ...all.filter((p) => p.id !== newPm.id)];
            this.setLocalData(STORAGE_KEYS.PAYMENT_METHODS, updated);
            return newPm;
          }
          if (error) {
            console.error('Supabase createPaymentMethod error:', error);
            throw new Error(error.message || 'Failed to create payment method.');
          }
        }
      } catch (err: any) {
        console.error('Error creating payment method:', err);
        throw err;
      }
    }

    const fallbackPm: PaymentMethod = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `pm-${Date.now()}`,
      user_id: userId,
      name: data.name.trim(),
      type: this.normalizePaymentMethodType(data.type),
      last4: data.last4?.trim() || null,
      color: data.color?.trim() || null,
      is_default: Boolean(data.is_default),
      created_at: new Date().toISOString(),
    };

    const all = this.getLocalData(STORAGE_KEYS.PAYMENT_METHODS, [] as PaymentMethod[]);
    const updated = [fallbackPm, ...all.filter((p) => p.id !== fallbackPm.id)];
    this.setLocalData(STORAGE_KEYS.PAYMENT_METHODS, updated);
    return fallbackPm;
  }

  // --- Profile & Preferences ---

  async getProfile(): Promise<Profile | null> {
    const supabase = createClient();
    if (supabase) {
      try {
        const user = await this.getAuthUser(supabase);

        if (user) {
          const { data, error } = await (supabase.from('profiles') as any)
            .select('*')
            .eq('id', user.id)
            .single();

          if (!error && data) {
            return data as Profile;
          }

          // Fallback profile from user metadata if profile row not yet created
          return {
            id: user.id,
            email: user.email || '',
            full_name: (user.user_metadata?.full_name as string) || '',
            currency_preference: 'USD',
            theme_preference: 'paper-ledger',
            default_reminder_days: [3, 1],
            created_at: user.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }
      } catch {
        // Fallback
      }
    }
    return this.getLocalData(STORAGE_KEYS.PROFILE, defaultProfile);
  }

  async updateProfile(updates: Partial<Profile>): Promise<Profile> {
    const current = (await this.getProfile()) || defaultProfile;
    const updated: Profile = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const supabase = createClient();
    if (supabase) {
      try {
        const user = await this.getAuthUser(supabase);

        if (user) {
          await (supabase.from('profiles') as any).upsert({
            id: user.id,
            email: user.email || current.email,
            full_name: updated.full_name,
            currency_preference: updated.currency_preference,
            theme_preference: updated.theme_preference,
            default_reminder_days: updated.default_reminder_days,
            updated_at: updated.updated_at,
          });
        }
      } catch {
        // Fallback
      }
    }

    this.setLocalData(STORAGE_KEYS.PROFILE, updated);
    return updated;
  }

  // Populate starter templates for a new user
  async populateStarterTemplates(): Promise<void> {
    const supabase = createClient();
    if (supabase) {
      const user = await this.getAuthUser(supabase);

      if (user) {
        for (const sub of mockSubscriptions.slice(0, 4)) {
          await this.createSubscription({
            name: sub.name,
            description: sub.description,
            amount: sub.amount,
            currency: sub.currency,
            billing_cycle: sub.billing_cycle,
            status: sub.status,
            category_id: sub.category_id,
            start_date: sub.start_date,
            next_renewal_date: sub.next_renewal_date,
            is_trial: sub.is_trial,
            trial_end_date: sub.trial_end_date,
            reminder_offsets: sub.reminder_offsets,
            value_rating: sub.value_rating,
            cancel_url: sub.cancel_url,
            notes: sub.notes,
          });
        }
        return;
      }
    }

    this.setLocalData(STORAGE_KEYS.SUBSCRIPTIONS, mockSubscriptions);
  }

  // Reset to initial state
  resetToSampleData(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.SUBSCRIPTIONS);
    localStorage.removeItem(STORAGE_KEYS.CATEGORIES);
    localStorage.removeItem(STORAGE_KEYS.PAYMENT_METHODS);
    localStorage.removeItem(STORAGE_KEYS.PROFILE);
  }

  // Clear all local records and purge database records for current user
  async clearAllData(): Promise<void> {
    const supabase = createClient();
    if (supabase) {
      const user = await this.getAuthUser(supabase);

      if (user) {
        await supabase.from('subscriptions').delete().eq('user_id', user.id);
        await supabase.from('categories').delete().eq('user_id', user.id);
        await supabase.from('payment_methods').delete().eq('user_id', user.id);
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.SUBSCRIPTIONS);
      localStorage.removeItem(STORAGE_KEYS.CATEGORIES);
      localStorage.removeItem(STORAGE_KEYS.PAYMENT_METHODS);
      localStorage.removeItem(STORAGE_KEYS.PROFILE);
      localStorage.removeItem('sift_statement_column_mappings_v1');
      localStorage.removeItem('sift_onboarding_dismissed_v1');
      localStorage.removeItem('sweep_onboarding_dismissed_v1');
    }
  }

  // Dashboard calculations summary
  async getDashboardSummary(): Promise<DashboardStats> {
    const subs = await this.getSubscriptions();
    return calculateDashboardStats(subs);
  }
}

export const subscriptionService = new SubscriptionService();
