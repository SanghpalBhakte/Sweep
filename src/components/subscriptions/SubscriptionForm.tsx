'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  BillingCycle,
  Category,
  PaymentMethod,
  Subscription,
  SubscriptionFormData,
  SubscriptionStatus,
  ValueRating,
} from '@/lib/types';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { SUPPORTED_CURRENCIES } from '@/lib/utils/currency';
import {
  Trash2,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCircle2,
  Search,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { POPULAR_SERVICES, PopularService } from '@/lib/constants/popularServices';
import { AddPaymentMethodModal } from './AddPaymentMethodModal';
import { AddCategoryModal } from './AddCategoryModal';

interface SubscriptionFormProps {
  initialData?: Subscription;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  onSubmit: (data: SubscriptionFormData) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  isEditing?: boolean;
}

export function SubscriptionForm({
  initialData,
  categories,
  paymentMethods,
  onSubmit,
  onDelete,
  isEditing = false,
}: SubscriptionFormProps) {
  const router = useRouter();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const initializedIdRef = useRef<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddPmModalOpen, setIsAddPmModalOpen] = useState(false);
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [extraPaymentMethods, setExtraPaymentMethods] = useState<PaymentMethod[]>([]);
  const [extraCategories, setExtraCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Available Categories (strictly from database query, including embedded initial relation if present)
  const availableCategories = useMemo(() => {
    const list = [...(categories || []), ...extraCategories];
    if (initialData?.category && !list.some((c) => c.id === initialData.category?.id)) {
      list.push(initialData.category);
    }
    const unique = Array.from(new Map(list.map((c) => [c.id, c])).values());
    return unique.sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, extraCategories, initialData?.category]);

  // Available Payment Methods (strictly from database query, including embedded initial relation if present)
  const availablePaymentMethods = useMemo(() => {
    const list = [...(paymentMethods || []), ...extraPaymentMethods];
    if (
      initialData?.payment_method &&
      !list.some((pm) => pm.id === initialData.payment_method?.id)
    ) {
      list.push(initialData.payment_method);
    }
    const unique = Array.from(new Map(list.map((pm) => [pm.id, pm])).values());
    return unique.sort((a, b) => a.name.localeCompare(b.name));
  }, [paymentMethods, extraPaymentMethods, initialData?.payment_method]);

  // Core Required Form State
  const [name, setName] = useState(initialData?.name || '');
  const [amount, setAmount] = useState<string>(initialData ? String(initialData.amount) : '');
  const [currency, setCurrency] = useState(initialData?.currency || 'USD');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    initialData?.billing_cycle || 'monthly'
  );
  const [nextRenewalDate, setNextRenewalDate] = useState(
    initialData?.next_renewal_date ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  // Category & Payment Method State
  const [categoryId, setCategoryId] = useState<string>(initialData?.category_id || '');
  const [paymentMethodId, setPaymentMethodId] = useState<string>(
    initialData?.payment_method_id || ''
  );

  // Optional / Advanced State
  const hasOptionalInitialData = Boolean(
    initialData?.description ||
      initialData?.notes ||
      initialData?.cancel_url ||
      initialData?.is_trial ||
      initialData?.monthly_alternative_price ||
      (initialData?.value_rating && initialData.value_rating !== 'useful')
  );

  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(
    isEditing || hasOptionalInitialData
  );
  const [description, setDescription] = useState(initialData?.description || '');
  const [customDays, setCustomDays] = useState<string>(
    initialData?.custom_interval_days ? String(initialData.custom_interval_days) : '30'
  );
  const [monthlyAlternativePrice, setMonthlyAlternativePrice] = useState<string>(
    initialData?.monthly_alternative_price ? String(initialData.monthly_alternative_price) : ''
  );
  const [status, setStatus] = useState<SubscriptionStatus>(initialData?.status || 'active');
  const [startDate, setStartDate] = useState(
    initialData?.start_date || new Date().toISOString().split('T')[0]
  );
  const [isTrial, setIsTrial] = useState<boolean>(initialData?.is_trial || false);
  const [trialEndDate, setTrialEndDate] = useState<string>(
    initialData?.trial_end_date ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [valueRating, setValueRating] = useState<ValueRating>(
    initialData?.value_rating || 'useful'
  );
  const [cancelUrl, setCancelUrl] = useState(initialData?.cancel_url || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [reminderDays, setReminderDays] = useState<number[]>(
    initialData?.reminder_offsets || [3, 1]
  );

  // State synchronization when editing a subscription
  useEffect(() => {
    if (!initialData) return;
    if (initializedIdRef.current === initialData.id) return;

    setName(initialData.name || '');
    setAmount(initialData.amount !== undefined ? String(initialData.amount) : '');
    setCurrency(initialData.currency || 'USD');
    setBillingCycle(initialData.billing_cycle || 'monthly');
    setNextRenewalDate(
      initialData.next_renewal_date ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );
    setCategoryId(initialData.category_id || '');
    setPaymentMethodId(initialData.payment_method_id || '');
    setDescription(initialData.description || '');
    setCustomDays(
      initialData.custom_interval_days ? String(initialData.custom_interval_days) : '30'
    );
    setMonthlyAlternativePrice(
      initialData.monthly_alternative_price
        ? String(initialData.monthly_alternative_price)
        : ''
    );
    setStatus(initialData.status || 'active');
    setStartDate(initialData.start_date || new Date().toISOString().split('T')[0]);
    setIsTrial(Boolean(initialData.is_trial));
    setTrialEndDate(
      initialData.trial_end_date ||
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );
    setValueRating(initialData.value_rating || 'useful');
    setCancelUrl(initialData.cancel_url || '');
    setNotes(initialData.notes || '');
    setReminderDays(initialData.reminder_offsets || [3, 1]);

    initializedIdRef.current = initialData.id;
  }, [initialData]);

  // Service Autocomplete Suggestions State
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);

  const filteredSuggestions = useMemo(() => {
    if (!name.trim() || name.trim().length < 1) return [];
    const query = name.trim().toLowerCase();
    return POPULAR_SERVICES.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        (s.description && s.description.toLowerCase().includes(query))
    ).slice(0, 5);
  }, [name]);

  useEffect(() => {
    if (nameInputRef.current && !isEditing) {
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isEditing]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        nameInputRef.current &&
        !nameInputRef.current.contains(e.target as Node)
      ) {
        setIsSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelectService = (service: PopularService) => {
    setName(service.name);

    if (service.defaultAmount !== undefined && (!amount || amount === '0')) {
      setAmount(String(service.defaultAmount));
    }
    if (service.billingCycle) {
      setBillingCycle(service.billingCycle);
    }
    if (service.cancelUrl && !cancelUrl) {
      setCancelUrl(service.cancelUrl);
    }
    if (service.description && !description) {
      setDescription(service.description);
    }

    if (service.categorySlug) {
      const matchedCat = availableCategories.find(
        (c) =>
          c.slug === service.categorySlug ||
          c.slug_aliases?.includes(service.categorySlug!)
      );
      if (matchedCat) {
        setCategoryId(matchedCat.id);
      }
    }

    setIsSuggestionsOpen(false);
  };

  const validateDateString = (dateStr: string, label: string): boolean => {
    if (!dateStr || !dateStr.trim()) {
      setError(`Please provide a valid date for ${label}.`);
      return false;
    }
    const parsed = Date.parse(dateStr);
    if (isNaN(parsed)) {
      setError(`Please enter a valid calendar date for ${label}.`);
      return false;
    }
    const year = new Date(parsed).getFullYear();
    if (year < 2000 || year > 2100) {
      setError(`Please enter a realistic year (2000–2100) for ${label}.`);
      return false;
    }
    return true;
  };

  const buildPayload = (): SubscriptionFormData | null => {
    if (!name.trim()) {
      setError('Please enter a service name.');
      nameInputRef.current?.focus();
      return null;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0 || !isFinite(parsedAmount)) {
      setError('Please enter a valid cost (0 or greater).');
      return null;
    }
    if (!validateDateString(nextRenewalDate, 'Next Billing Date')) {
      return null;
    }
    if (startDate && !validateDateString(startDate, 'Start Date')) {
      return null;
    }
    if (isTrial && trialEndDate && !validateDateString(trialEndDate, 'Trial Expiration Date')) {
      return null;
    }

    const parsedMonthlyAlt =
      billingCycle === 'yearly' && monthlyAlternativePrice
        ? parseFloat(monthlyAlternativePrice)
        : undefined;

    let prevAmount = initialData?.previous_amount || undefined;
    let priceHikeReviewedAt = initialData?.price_hike_reviewed_at || undefined;

    if (initialData && parsedAmount !== initialData.amount) {
      prevAmount = initialData.amount;
      priceHikeReviewedAt = undefined;
    }

    const resolvedCategoryId =
      categoryId && categoryId.trim() !== '' ? categoryId.trim() : null;
    const resolvedPaymentMethodId =
      paymentMethodId && paymentMethodId.trim() !== '' ? paymentMethodId.trim() : null;

    return {
      name: name.trim(),
      description: description.trim() || undefined,
      amount: parsedAmount,
      currency,
      billing_cycle: billingCycle,
      custom_interval_days:
        billingCycle === 'custom' ? parseInt(customDays, 10) || 30 : undefined,
      monthly_alternative_price:
        parsedMonthlyAlt && parsedMonthlyAlt > 0 ? parsedMonthlyAlt : undefined,
      status,
      category_id: resolvedCategoryId,
      payment_method_id: resolvedPaymentMethodId,
      start_date: startDate,
      next_renewal_date: nextRenewalDate,
      is_trial: isTrial,
      trial_end_date: isTrial ? trialEndDate : undefined,
      reminder_offsets: reminderDays,
      value_rating: valueRating,
      cancel_url: cancelUrl.trim() || undefined,
      notes: notes.trim() || undefined,
      previous_amount: prevAmount,
      price_hike_reviewed_at: priceHikeReviewedAt,
      cancellation_reason: initialData?.cancellation_reason,
      cancellation_effective_date: initialData?.cancellation_effective_date,
    };
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setSuccessNotice(null);

    const payload = buildPayload();
    if (!payload) return;

    const selectedCatName =
      availableCategories.find((c) => c.id === payload.category_id)?.name ||
      'None / Unassigned';
    const selectedPmName =
      availablePaymentMethods.find((pm) => pm.id === payload.payment_method_id)?.name ||
      'None / Unassigned';

    console.log('subscription submit values', {
      billingCycle: payload.billing_cycle,
      categoryId: payload.category_id || null,
      categoryName: selectedCatName,
      paymentMethodId: payload.payment_method_id || null,
      paymentMethodName: selectedPmName,
    });
    console.log('subscription insert/update payload', payload);

    setIsSubmitting(true);
    try {
      await onSubmit(payload);
      if (!isEditing) {
        router.push('/subscriptions');
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'An error occurred while saving the subscription.';
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAndAddAnother = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setSuccessNotice(null);

    const payload = buildPayload();
    if (!payload) return;

    const selectedCatName =
      availableCategories.find((c) => c.id === payload.category_id)?.name ||
      'None / Unassigned';
    const selectedPmName =
      availablePaymentMethods.find((pm) => pm.id === payload.payment_method_id)?.name ||
      'None / Unassigned';

    console.log({
      categoryId: payload.category_id || null,
      categoryName: selectedCatName,
      paymentMethodId: payload.payment_method_id || null,
      paymentMethodName: selectedPmName,
    });

    setIsSubmitting(true);
    try {
      await onSubmit(payload);

      // Reset form for next entry
      const savedName = name.trim();
      setName('');
      setAmount('');
      setDescription('');
      setCancelUrl('');
      setNotes('');
      setIsTrial(false);
      setCategoryId('');
      setPaymentMethodId('');
      setNextRenewalDate(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      );

      setSuccessNotice(`Saved "${savedName}". Ready for your next subscription.`);

      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'An error occurred while saving the subscription.';
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData || !onDelete || isDeleting) return;
    if (confirm(`Are you sure you want to delete ${initialData.name}?`)) {
      setIsDeleting(true);
      try {
        await onDelete(initialData.id);
        router.push('/subscriptions');
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error ? err.message : 'Failed to delete the subscription.';
        setError(errorMsg);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const toggleReminderDay = (day: number) => {
    if (reminderDays.includes(day)) {
      setReminderDays(reminderDays.filter((d) => d !== day));
    } else {
      setReminderDays([...reminderDays, day].sort((a, b) => b - a));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-xl mx-auto pb-12">
      {/* Header with clear back/cancel path */}
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-border">
        <div className="flex items-center gap-2.5">
          <Link
            href="/subscriptions"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
            aria-label="Back to subscriptions"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {isEditing ? `Edit ${initialData?.name}` : 'New Subscription'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isEditing
                ? 'Update commitment details and renewal reminders.'
                : 'Track a recurring service or free trial.'}
            </p>
          </div>
        </div>

        {isEditing && onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            isLoading={isDeleting}
            disabled={isDeleting || isSubmitting}
            className="text-xs text-danger hover:bg-danger-subtle gap-1.5 cursor-pointer"
            aria-label="Delete subscription"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        ) : null}
      </div>

      {/* Transient Success Notice */}
      {successNotice ? (
        <div className="p-3 text-xs bg-success-subtle border border-success/30 text-success rounded-lg flex items-center gap-2 animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successNotice}</span>
        </div>
      ) : null}

      {/* Error Alert with Actionable Retry Button */}
      {error ? (
        <div className="p-3.5 text-xs bg-danger-subtle border border-danger/25 text-danger rounded-xl flex items-start justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-start gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <p className="font-semibold">Unable to save subscription</p>
              <p className="text-danger/90 break-words">{error}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleSubmit()}
            isLoading={isSubmitting}
            className="text-xs shrink-0 text-danger border-danger/30 hover:bg-danger-subtle cursor-pointer"
          >
            Retry
          </Button>
        </div>
      ) : null}

      {/* Required Core Details Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">
            Subscription Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {/* Service Search / Autocomplete Field */}
          <div className="relative">
            <div className="w-full space-y-1.5">
              <label
                htmlFor="service-name-input"
                className="text-xs font-medium text-foreground flex items-center justify-between"
              >
                <span>Service / Tool Name *</span>
                {!isEditing && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-normal">
                    <Search className="w-2.5 h-2.5" />
                    Quick search or type custom
                  </span>
                )}
              </label>
              <input
                id="service-name-input"
                ref={nameInputRef}
                type="text"
                autoFocus={!isEditing}
                required
                autoComplete="off"
                placeholder="e.g., Cursor, Spotify, iCloud, Netflix"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setIsSuggestionsOpen(true);
                  if (error) setError(null);
                }}
                onFocus={() => {
                  if (filteredSuggestions.length > 0) setIsSuggestionsOpen(true);
                }}
                className="sweep-input w-full"
              />
            </div>

            {/* Suggestions Dropdown */}
            {isSuggestionsOpen && filteredSuggestions.length > 0 ? (
              <div
                ref={dropdownRef}
                className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-md overflow-hidden animate-in fade-in duration-100"
              >
                <div className="px-2.5 py-1.5 bg-surface/50 border-b border-border/60 text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span>Popular suggestions</span>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-border/40">
                  {filteredSuggestions.map((service) => (
                    <button
                      key={service.name}
                      type="button"
                      onClick={() => handleSelectService(service)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-surface flex items-center justify-between gap-2 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <span className="font-medium text-foreground block truncate">
                          {service.name}
                        </span>
                        {service.description && (
                          <span className="text-[10px] text-muted-foreground block truncate">
                            {service.description}
                          </span>
                        )}
                      </div>
                      {service.defaultAmount !== undefined && (
                        <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                          ${service.defaultAmount}/{service.billingCycle === 'yearly' ? 'yr' : 'mo'}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Input
                label="Cost / Amount *"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (error) setError(null);
                }}
                required
              />
            </div>

            <Select
              label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol})
                </option>
              ))}
            </Select>
          </div>

          {/* Billing Cycle & Next Billing Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Billing Cycle *"
              value={billingCycle}
              onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly (Annual)</option>
            </Select>

            <Input
              label="Next Billing Date *"
              type="date"
              value={nextRenewalDate}
              onChange={(e) => setNextRenewalDate(e.target.value)}
              required
            />
          </div>

          {/* Category & Payment Method */}
          <div className="pt-2 border-t border-border/60">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground">Category (Optional)</label>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsAddCatModalOpen(true);
                    }}
                    className="text-[11px] font-medium text-primary hover:underline cursor-pointer flex items-center gap-0.5"
                  >
                    + Add New
                  </button>
                </div>
                <Select
                  id="subscription-category"
                  aria-label="Category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">None / Unassigned</option>
                  {availableCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground">Payment Method (Optional)</label>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsAddPmModalOpen(true);
                    }}
                    className="text-[11px] font-medium text-primary hover:underline cursor-pointer flex items-center gap-0.5"
                  >
                    + Add New
                  </button>
                </div>
                <Select
                  id="subscription-payment-method"
                  aria-label="Payment method"
                  value={paymentMethodId}
                  onChange={(e) => setPaymentMethodId(e.target.value)}
                >
                  <option value="">None / Unassigned</option>
                  {availablePaymentMethods.length === 0 ? (
                    <option value="" disabled>No payment methods yet</option>
                  ) : (
                    availablePaymentMethods.map((pm) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.name} {pm.last4 ? `(•••• ${pm.last4})` : ''}
                      </option>
                    ))
                  )}
                </Select>
                {availablePaymentMethods.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground flex items-center justify-between pt-0.5">
                    <span>No payment methods yet. Add one to get started.</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsAddPmModalOpen(true);
                      }}
                      className="text-primary hover:underline font-semibold cursor-pointer"
                    >
                      + Add
                    </button>
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Collapsible Additional Details */}
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowMoreOptions(!showMoreOptions)}
          className="w-full px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground flex items-center justify-between transition-colors cursor-pointer bg-surface/30"
        >
          <span>
            {showMoreOptions
              ? 'Hide additional options'
              : '+ Add notes, trial alerts & details (Optional)'}
          </span>
          {showMoreOptions ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>

        {showMoreOptions ? (
          <div className="p-4 space-y-4 border-t border-border/60 animate-in fade-in duration-150">
            <Input
              label="Short Description"
              placeholder="e.g., Team license, personal account"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            {/* Annual Plan Arbitrage */}
            {billingCycle === 'yearly' ? (
              <Input
                label="Monthly Alternative Price"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g., 10.00"
                value={monthlyAlternativePrice}
                onChange={(e) => setMonthlyAlternativePrice(e.target.value)}
                helperText="Enter monthly price if billed monthly to compute annual plan savings."
              />
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />

              <Select
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="canceled">Canceled</option>
                <option value="archived">Archived</option>
              </Select>
            </div>

            {/* Free Trial Toggle */}
            <div className="p-3 rounded-lg bg-surface/40 border border-border/60 space-y-2.5">
              <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTrial}
                  onChange={(e) => setIsTrial(e.target.checked)}
                  className="w-4 h-4 rounded text-primary border-border accent-primary"
                />
                <span>Free trial period</span>
              </label>

              {isTrial ? (
                <div className="pl-6 pt-1">
                  <Input
                    label="Trial Expiration Date *"
                    type="date"
                    value={trialEndDate}
                    onChange={(e) => setTrialEndDate(e.target.value)}
                    required={isTrial}
                    helperText="Advance reminder sent before expiration."
                  />
                </div>
              ) : null}
            </div>

            {/* Value Tier & Cancellation Link */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Value Tier"
                value={valueRating}
                onChange={(e) => setValueRating(e.target.value as ValueRating)}
              >
                <option value="essential">Essential (use it all the time)</option>
                <option value="useful">Useful (use it often)</option>
                <option value="rarely_used">Rarely used (hardly use it)</option>
                <option value="cancel_candidate">Cancel candidate (planning to cancel)</option>
              </Select>

              <Input
                label="Direct Cancellation Link"
                type="url"
                placeholder="https://service.com/account/billing"
                value={cancelUrl}
                onChange={(e) => setCancelUrl(e.target.value)}
              />
            </div>

            {/* Renewal Reminders */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground block">
                Renewal Alert Offsets (Days prior)
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {[7, 3, 1, 0].map((day) => {
                  const isSelected = reminderDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleReminderDay(day)}
                      className={cn(
                        'px-2.5 py-1 rounded-md border text-xs font-medium transition-all cursor-pointer',
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary font-semibold'
                          : 'border-border bg-surface text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {day === 0 ? 'On renewal date' : `${day}d before`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Private Notes Field */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground block">
                Private Notes
              </label>
              <textarea
                rows={2}
                placeholder="e.g., Annual discount code, shared with team..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="sweep-input w-full resize-none text-xs"
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Form Action Buttons */}
      <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2">
        <Button
          type="button"
          variant="outline"
          size="md"
          disabled={isSubmitting || isDeleting}
          onClick={() => router.push('/subscriptions')}
          className="w-full sm:w-auto text-xs cursor-pointer"
        >
          Cancel
        </Button>

        {!isEditing ? (
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={handleSaveAndAddAnother}
            isLoading={isSubmitting}
            disabled={isSubmitting || isDeleting}
            className="w-full sm:w-auto text-xs cursor-pointer"
          >
            Save & Add Another
          </Button>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isSubmitting}
          disabled={isSubmitting || isDeleting}
          className="w-full sm:w-auto shadow-xs font-medium text-xs cursor-pointer"
        >
          {isEditing ? 'Update Subscription' : 'Save Subscription'}
        </Button>
      </div>

      <AddPaymentMethodModal
        isOpen={isAddPmModalOpen}
        onClose={() => setIsAddPmModalOpen(false)}
        onCreated={(pm) => {
          setExtraPaymentMethods((prev) => [...prev.filter((p) => p.id !== pm.id), pm]);
          setPaymentMethodId(pm.id);
        }}
      />

      <AddCategoryModal
        isOpen={isAddCatModalOpen}
        onClose={() => setIsAddCatModalOpen(false)}
        onCreated={(cat) => {
          setExtraCategories((prev) => [...prev.filter((c) => c.id !== cat.id), cat]);
          setCategoryId(cat.id);
        }}
      />
    </form>
  );
}
