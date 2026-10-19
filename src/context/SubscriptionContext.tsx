'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Category,
  DashboardStats,
  ExchangeRatesData,
  PaymentMethod,
  Profile,
  Subscription,
  SubscriptionFilters,
  SubscriptionFormData,
} from '../lib/types';
import { subscriptionService } from '../lib/services/subscriptionService';
import { calculateDashboardStats } from '../lib/utils/analytics';
import { DEFAULT_OFFLINE_RATES, exchangeRateService } from '../lib/services/exchangeRateService';
import { useAuth } from './AuthContext';

interface SubscriptionContextType {
  subscriptions: Subscription[];
  categories: Category[];
  paymentMethods: PaymentMethod[];
  profile: Profile | null;
  exchangeRates: ExchangeRatesData;
  displayCurrency: string;
  isLoading: boolean;
  filters: SubscriptionFilters;
  stats: DashboardStats;
  setFilters: React.Dispatch<React.SetStateAction<SubscriptionFilters>>;
  addSubscription: (data: SubscriptionFormData) => Promise<Subscription>;
  addCategory: (data: { name: string; slug?: string; color?: string; icon?: string }) => Promise<Category>;
  updateCategory: (id: string, data: Partial<{ name: string; slug: string; color: string; icon: string }>) => Promise<Category>;
  addPaymentMethod: (data: { name: string; type: string; last4?: string | null; color?: string | null; is_default?: boolean }) => Promise<PaymentMethod>;
  updateSubscription: (id: string, data: Partial<SubscriptionFormData>) => Promise<Subscription>;
  deleteSubscription: (id: string) => Promise<void>;
  toggleStatus: (id: string, currentStatus: string) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  populateStarterTemplates: () => Promise<void>;
  resetToSampleData: () => Promise<void>;
  clearAllData: () => Promise<void>;
  refreshExchangeRates: (force?: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRatesData>({
    base: 'USD',
    rates: DEFAULT_OFFLINE_RATES,
    updatedAt: new Date().toISOString(),
    source: 'Offline Static Baseline',
  });

  const inFlightLoadRef = useRef<Promise<void> | null>(null);

  const [filters, setFilters] = useState<SubscriptionFilters>({
    status: 'all',
    category_id: 'all',
    value_rating: 'all',
    billing_cycle: 'all',
    sortBy: 'next_renewal_date',
    sortOrder: 'asc',
  });

  const displayCurrency = profile?.currency_preference || 'USD';

  const loadExchangeRates = useCallback(async (force = false) => {
    try {
      const data = await exchangeRateService.getExchangeRates(force);
      setExchangeRates(data);
    } catch (err) {
      console.warn('Error loading exchange rates:', err);
    }
  }, []);

  const loadAll = useCallback(async (isInitial = false) => {
    // If a load request is already in flight, reuse it
    if (inFlightLoadRef.current) {
      return inFlightLoadRef.current;
    }

    const loadPromise = (async () => {
      try {
        const [subs, cats, pms, prof, rates] = await Promise.all([
          subscriptionService.getSubscriptions(),
          subscriptionService.getCategories(),
          subscriptionService.getPaymentMethods(),
          subscriptionService.getProfile(),
          exchangeRateService.getExchangeRates(),
        ]);
        setSubscriptions(subs);
        setCategories(cats);
        setPaymentMethods(pms);
        setProfile(prof);
        setExchangeRates(rates);
      } catch (err) {
        console.error('Error loading subscription data:', err);
      } finally {
        setIsLoading(false);
        inFlightLoadRef.current = null;
      }
    })();

    inFlightLoadRef.current = loadPromise;
    return loadPromise;
  }, []);

  const userId = user?.id;

  useEffect(() => {
    // Reset state when switching user accounts
    inFlightLoadRef.current = null;
    if (userId) {
      setIsLoading(true);
    }

    // Seed from local storage cache only when offline / initial guest mode
    if (!userId) {
      try {
        const cachedSubs =
          localStorage.getItem('sweep_subscriptions_v1') ||
          localStorage.getItem('sift_subscriptions_v1');
        if (cachedSubs) {
          const parsed = JSON.parse(cachedSubs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSubscriptions(parsed);
            setIsLoading(false);
          }
        }
      } catch {
        // Continue with regular fetch
      }
    }

    loadAll(true);

    // Background reconnect sync for exchange rates
    const cleanup = exchangeRateService.initReconnectSync((updatedRates) => {
      setExchangeRates(updatedRates);
    });

    return () => cleanup();
  }, [loadAll, userId]);

  // Optimistic Add
  const addSubscription = async (data: SubscriptionFormData): Promise<Subscription> => {
    const created = await subscriptionService.createSubscription(data);
    setSubscriptions((prev) => [created, ...prev.filter((s) => s.id !== created.id)]);
    // Revalidate with fresh query
    inFlightLoadRef.current = null;
    loadAll();
    return created;
  };

  const addCategory = async (data: {
    name: string;
    slug?: string;
    color?: string;
    icon?: string;
  }): Promise<Category> => {
    const created = await subscriptionService.createCategory(data);
    setCategories((prev) => [...prev.filter((c) => c.id !== created.id), created]);
    inFlightLoadRef.current = null;
    loadAll();
    return created;
  };

  const updateCategory = async (
    id: string,
    data: Partial<{ name: string; slug: string; color: string; icon: string }>
  ): Promise<Category> => {
    const updated = await subscriptionService.updateCategory(id, data);
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
    inFlightLoadRef.current = null;
    loadAll();
    return updated;
  };

  const addPaymentMethod = async (data: {
    name: string;
    type: string;
    last4?: string | null;
    color?: string | null;
    is_default?: boolean;
  }): Promise<PaymentMethod> => {
    const created = await subscriptionService.createPaymentMethod(data);
    setPaymentMethods((prev) => [...prev.filter((p) => p.id !== created.id), created]);
    inFlightLoadRef.current = null;
    loadAll();
    return created;
  };

  // Optimistic Update with rollback
  const updateSubscription = async (
    id: string,
    data: Partial<SubscriptionFormData>
  ): Promise<Subscription> => {
    const previous = subscriptions;
    try {
      const updated = await subscriptionService.updateSubscription(id, data);
      setSubscriptions((prev) => prev.map((s) => (s.id === id ? updated : s)));
      inFlightLoadRef.current = null;
      loadAll();
      return updated;
    } catch (err) {
      setSubscriptions(previous);
      throw err;
    }
  };

  // Optimistic Delete with rollback
  const deleteSubscription = async (id: string): Promise<void> => {
    const previous = subscriptions;
    setSubscriptions((prev) => prev.filter((s) => s.id !== id));
    try {
      await subscriptionService.deleteSubscription(id);
      inFlightLoadRef.current = null;
      loadAll();
    } catch (err) {
      setSubscriptions(previous);
      throw err;
    }
  };

  // Optimistic Toggle Status with rollback
  const toggleStatus = async (id: string, currentStatus: string): Promise<void> => {
    const previous = subscriptions;
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    setSubscriptions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: newStatus as Subscription['status'] } : s))
    );
    try {
      await subscriptionService.updateSubscription(id, {
        status: newStatus as Subscription['status'],
      });
      inFlightLoadRef.current = null;
      loadAll();
    } catch (err) {
      setSubscriptions(previous);
      throw err;
    }
  };

  const handleUpdateProfile = async (updates: Partial<Profile>): Promise<void> => {
    const updated = await subscriptionService.updateProfile(updates);
    setProfile(updated);
  };

  const handlePopulateStarterTemplates = async (): Promise<void> => {
    await subscriptionService.populateStarterTemplates();
    await loadAll();
  };

  const handleResetToSampleData = async (): Promise<void> => {
    subscriptionService.resetToSampleData();
    await loadAll();
  };

  const handleClearAllData = async (): Promise<void> => {
    await subscriptionService.clearAllData();
    setSubscriptions([]);
    await loadAll();
  };

  // Rows saved without a joined category / payment method (offline mode, optimistic
  // updates) only carry the ids, so fill the objects in from the loaded lists.
  const hydratedSubscriptions = useMemo(() => {
    const catById = new Map(categories.map((c) => [c.id, c]));
    const pmById = new Map(paymentMethods.map((pm) => [pm.id, pm]));
    return subscriptions.map((sub) => {
      const category = sub.category ?? (sub.category_id ? catById.get(sub.category_id) : undefined);
      const payment_method =
        sub.payment_method ?? (sub.payment_method_id ? pmById.get(sub.payment_method_id) : undefined);
      return category === sub.category && payment_method === sub.payment_method
        ? sub
        : { ...sub, category, payment_method };
    });
  }, [subscriptions, categories, paymentMethods]);

  // Compute live dashboard stats reactively from current optimistic subscriptions
  const stats: DashboardStats = useMemo(() => {
    return calculateDashboardStats(
      hydratedSubscriptions,
      displayCurrency,
      exchangeRates.rates
    );
  }, [hydratedSubscriptions, displayCurrency, exchangeRates.rates]);

  return (
    <SubscriptionContext.Provider
      value={{
        subscriptions: hydratedSubscriptions,
        categories,
        paymentMethods,
        profile,
        exchangeRates,
        displayCurrency,
        isLoading,
        filters,
        stats,
        setFilters,
        addSubscription,
        addCategory,
        updateCategory,
        addPaymentMethod,
        updateSubscription,
        deleteSubscription,
        toggleStatus,
        updateProfile: handleUpdateProfile,
        populateStarterTemplates: handlePopulateStarterTemplates,
        resetToSampleData: handleResetToSampleData,
        clearAllData: handleClearAllData,
        refreshExchangeRates: loadExchangeRates,
        refresh: () => loadAll(false),
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscriptions() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscriptions must be used within a SubscriptionProvider');
  }
  return context;
}
