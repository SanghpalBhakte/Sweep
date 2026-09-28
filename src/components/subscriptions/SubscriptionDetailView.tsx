'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Subscription, Category, PaymentMethod, SubscriptionFormData } from '@/lib/types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { ValueRatingTag } from '../ui/ValueRatingTag';
import { SubscriptionForm } from './SubscriptionForm';
import { formatCurrency, formatCycle, convertCurrency } from '@/lib/utils/currency';
import { getCountdownBadge, formatDate } from '@/lib/utils/dates';
import { useSubscriptions } from '@/context/SubscriptionContext';
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  ExternalLink,
  Edit3,
  Trash2,
  Pause,
  Play,
  Scissors,
  Clock,
  FileText,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface SubscriptionDetailViewProps {
  subscription: Subscription;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  onUpdate: (data: SubscriptionFormData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  initialEditMode?: boolean;
}

export function SubscriptionDetailView({
  subscription,
  categories,
  paymentMethods,
  onUpdate,
  onDelete,
  initialEditMode = false,
}: SubscriptionDetailViewProps) {
  const router = useRouter();
  const { displayCurrency, exchangeRates, toggleStatus } = useSubscriptions();

  const [isEditMode, setIsEditMode] = useState(initialEditMode);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const countdown = getCountdownBadge(subscription.next_renewal_date);
  const isDifferentCurrency =
    subscription.currency.toUpperCase() !== displayCurrency.toUpperCase();

  const convertedMonthly = isDifferentCurrency
    ? convertCurrency(
        subscription.monthly_amount,
        subscription.currency,
        displayCurrency,
        exchangeRates.rates
      )
    : null;

  // Inferred estimated billing timeline
  const estimatedDates = React.useMemo(() => {
    const next = new Date(subscription.next_renewal_date);
    const intervalDays =
      subscription.billing_cycle === 'yearly'
        ? 365
        : subscription.billing_cycle === 'quarterly'
        ? 90
        : subscription.custom_interval_days || 30;

    const past1 = new Date(next.getTime() - intervalDays * 24 * 60 * 60 * 1000);
    const next2 = new Date(next.getTime() + intervalDays * 24 * 60 * 60 * 1000);

    return [
      {
        date: past1.toISOString().split('T')[0],
        label: 'Previous billing (Estimated)',
        status: 'past',
      },
      {
        date: subscription.next_renewal_date,
        label: 'Next scheduled billing',
        status: 'current',
      },
      {
        date: next2.toISOString().split('T')[0],
        label: 'Upcoming renewal (Projected)',
        status: 'future',
      },
    ];
  }, [subscription]);

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(subscription.id);
      router.push('/subscriptions');
    } catch (err) {
      console.error('Failed to delete subscription:', err);
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!toggleStatus) return;
    const newStatus = subscription.status === 'active' ? 'paused' : 'active';
    await toggleStatus(subscription.id, subscription.status);
    setStatusMessage(
      newStatus === 'paused'
        ? `"${subscription.name}" marked as paused.`
        : `"${subscription.name}" resumed as active.`
    );
  };

  const handleUpdate = async (data: SubscriptionFormData) => {
    await onUpdate(data);
    setIsEditMode(false);
    setStatusMessage(`Saved updates to "${data.name}".`);
  };

  // Edit Mode view
  if (isEditMode) {
    return (
      <div className="space-y-4 max-w-xl mx-auto py-2 animate-in fade-in duration-150">
        <SubscriptionForm
          initialData={subscription}
          categories={categories}
          paymentMethods={paymentMethods}
          onSubmit={handleUpdate}
          onDelete={onDelete}
          isEditing={true}
        />
      </div>
    );
  }

  // Read / Detail View
  return (
    <div className="space-y-5 max-w-xl mx-auto py-2 pb-16 animate-in fade-in duration-200">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-border">
        <Link
          href="/subscriptions"
          className="tap -ml-1.5 gap-1.5 p-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Subscriptions</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsEditMode(true)}
            className="text-xs gap-1.5 shadow-xs"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </Button>
        </div>
      </div>

      {/* Transient Status Message */}
      {statusMessage ? (
        <div className="p-3 text-xs bg-success-subtle border border-success/30 text-success rounded-lg flex items-center justify-between gap-2 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-success hover:opacity-75 text-[11px] font-medium cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* 1. Visual Anchor & Hero Summary Card */}
      <div className="sweep-card p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          {/* Logo / Anchor Badge & Title */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-bold text-lg sm:text-xl shadow-xs shrink-0"
              style={{
                backgroundColor: subscription.category?.color
                  ? `${subscription.category.color}20`
                  : 'hsl(var(--surface-muted))',
                color: subscription.category?.color || 'hsl(var(--primary))',
              }}
            >
              {subscription.name.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0">
              <h1 className="font-serif text-2xl sm:text-3xl tracking-tight text-foreground truncate">
                {subscription.name}
              </h1>

              <div className="flex items-center gap-2 flex-wrap mt-1">
                {subscription.status === 'paused' ? (
                  <Badge variant="muted" size="sm">Paused</Badge>
                ) : subscription.status === 'canceled' ? (
                  <Badge variant="danger" size="sm">Canceled</Badge>
                ) : (
                  <Badge variant="outline" size="sm" className="text-success border-success/30">
                    Active
                  </Badge>
                )}

                {subscription.category ? (
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: subscription.category.color }}
                    />
                    {subscription.category.name}
                  </span>
                ) : null}

                <ValueRatingTag rating={subscription.value_rating} size="sm" />
              </div>
            </div>
          </div>
        </div>

        {/* Cost & Next Billing Hero Box */}
        <div className="p-4 rounded-xl bg-surface/50 border border-border flex items-center justify-between gap-4 flex-wrap">
          <div>
            <span className="text-[11px] font-medium text-muted-foreground block">
              Cost & Frequency
            </span>
            <div className="text-2xl font-bold text-foreground tabular-nums">
              {formatCurrency(subscription.amount, subscription.currency)}
              <span className="text-xs font-normal text-muted-foreground ml-1">
                {formatCycle(subscription.billing_cycle, subscription.custom_interval_days)}
              </span>
            </div>
            {isDifferentCurrency && convertedMonthly !== null ? (
              <span className="text-xs text-primary font-medium">
                ≈ {formatCurrency(convertedMonthly, displayCurrency)}/month
              </span>
            ) : null}
          </div>

          <div className="text-right">
            <span className="text-[11px] font-medium text-muted-foreground block">
              Next Billing Date
            </span>
            <div className="text-sm font-semibold text-foreground">
              {formatDate(subscription.next_renewal_date)}
            </div>
            {countdown.label ? (
              <span
                className={cn(
                  'text-[11px] font-medium inline-block mt-0.5',
                  countdown.urgent ? 'text-danger' : countdown.warning ? 'text-warning' : 'text-muted-foreground'
                )}
              >
                {countdown.label}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* 2. Core Subscription Metadata Details */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Subscription Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-1 border-b border-border/50">
            <div>
              <span className="text-muted-foreground block">Payment Method</span>
              <span className="font-medium text-foreground">
                {subscription.payment_method
                  ? `${subscription.payment_method.name} ${
                      subscription.payment_method.last4
                        ? `(•••• ${subscription.payment_method.last4})`
                        : ''
                    }`
                  : 'Unassigned / Direct'}
              </span>
            </div>

            <div>
              <span className="text-muted-foreground block">Start Date</span>
              <span className="font-medium text-foreground">
                {formatDate(subscription.start_date)}
              </span>
            </div>
          </div>

          {subscription.description ? (
            <div className="py-1 border-b border-border/50">
              <span className="text-muted-foreground block">Description</span>
              <span className="font-medium text-foreground">{subscription.description}</span>
            </div>
          ) : null}

          {subscription.cancel_url ? (
            <div className="py-1 flex items-center justify-between gap-2">
              <div>
                <span className="text-muted-foreground block">Account Billing Page</span>
                <span className="font-medium text-foreground truncate block max-w-xs sm:max-w-sm">
                  {subscription.cancel_url}
                </span>
              </div>
              <a
                href={subscription.cancel_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface border border-border text-xs font-medium text-primary hover:underline shrink-0"
              >
                <span>Open</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 3. Private Notes (Only displayed when non-empty) */}
      {subscription.notes && subscription.notes.trim() ? (
        <Card>
          <CardHeader className="pb-2 flex items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary" />
              <span>Private Notes</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed bg-surface/40 p-3 rounded-lg border border-border/60">
              {subscription.notes}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* 4. Estimated Billing History (Clearly marked as estimated/inferred) */}
      <Card>
        <CardHeader className="pb-2">
          <div className="space-y-0.5">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Billing Schedule (Estimated)</span>
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Estimated timeline inferred from {subscription.billing_cycle} renewal frequency.
            </p>
          </div>
        </CardHeader>
        <CardContent className="pt-1 space-y-2">
          {estimatedDates.map((item, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center justify-between p-2.5 rounded-lg text-xs border',
                item.status === 'current'
                  ? 'bg-primary/5 border-primary/30 font-medium'
                  : 'bg-surface/30 border-border/60 text-muted-foreground'
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full',
                    item.status === 'current'
                      ? 'bg-primary'
                      : item.status === 'past'
                      ? 'bg-muted-foreground/40'
                      : 'bg-muted-foreground/20'
                  )}
                />
                <span>{item.label}</span>
              </div>
              <span className="font-mono tabular-nums">{formatDate(item.date)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 5. Non-Destructive vs. Destructive Action Footer */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
          Subscription Actions
        </span>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Non-Destructive Status Action */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleToggleStatus}
            className="w-full sm:w-auto text-xs gap-1.5"
          >
            {subscription.status === 'active' ? (
              <>
                <Pause className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Mark as Paused</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-primary" />
                <span>Resume Subscription</span>
              </>
            )}
          </Button>

          {/* Destructive Delete Action (Confirmation Gated) */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsDeleteModalOpen(true)}
            className="w-full sm:w-auto text-xs text-danger hover:bg-danger-subtle gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Subscription</span>
          </Button>
        </div>
      </div>

      {/* Confirmation Modal for Destructive Delete */}
      {isDeleteModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="sweep-card max-w-sm w-full p-5 space-y-4 shadow-xl border-danger/30">
            <div className="flex items-center gap-2.5 text-danger font-semibold text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Delete Subscription</span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to delete <strong>{subscription.name}</strong>? This action is permanent and removes it from your recurring ledger.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
                className="text-xs"
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleConfirmDelete}
                isLoading={isDeleting}
                className="text-xs bg-danger hover:bg-danger/90 border-transparent text-danger-foreground font-semibold"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
