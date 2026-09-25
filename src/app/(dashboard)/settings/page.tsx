'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { useNotifications } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Select } from '@/components/ui/Select';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SUPPORTED_CURRENCIES } from '@/lib/utils/currency';
import dynamic from 'next/dynamic';
import {
  generateFullBackupJson,
  generateSubscriptionsCsv,
  generateBackupReadme,
  downloadFile,
} from '@/lib/utils/backup';

const RestoreModal = dynamic(
  () => import('@/components/backup/RestoreModal').then((m) => m.RestoreModal),
  { ssr: false }
);
const CustomBankRulesManager = dynamic(
  () =>
    import('@/components/settings/CustomBankRulesManager').then(
      (m) => m.CustomBankRulesManager
    ),
  { ssr: false }
);
import { AddPaymentMethodModal } from '@/components/subscriptions/AddPaymentMethodModal';
import {
  Palette,
  Database,
  Download,
  FileSpreadsheet,
  Info,
  ShieldCheck,
  RefreshCw,
  Archive,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Heart,
  Sliders,
  LogOut,
  KeyRound,
  Lock,
  CreditCard,
  Plus,
  LogIn,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const REMINDER_OFFSET_OPTIONS = [
  { days: 7, label: '7 days before' },
  { days: 3, label: '3 days before' },
  { days: 1, label: '1 day before' },
  { days: 0, label: 'On renewal day' },
];

const ANNUAL_BENCHMARK_OPTIONS = [
  { value: 10, label: '10% (about 1 month free)' },
  { value: 15, label: '15% (a common yearly discount)' },
  { value: 16.7, label: '16.7% (default, 2 months free)' },
  { value: 20, label: '20% (about 2.4 months free)' },
];

export default function SettingsPage() {
  const { resolvedTheme } = useTheme();
  const { user, isConfigured, signOut, unenrollMFA } = useAuth();
  const {
    subscriptions,
    categories,
    paymentMethods,
    profile,
    updateProfile,
    populateStarterTemplates,
    refreshExchangeRates,
    clearAllData,
    refresh,
  } = useSubscriptions();

  const {
    isPushSupported,
    isPushSubscribed,
    enablePushNotifications,
    disablePushNotifications,
    sendTestPushNotification,
    updatePreferences,
  } = useNotifications();

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isAddPmModalOpen, setIsAddPmModalOpen] = useState(false);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const [isSyncingRates, setIsSyncingRates] = useState(false);
  const [ratesSyncSuccess, setRatesSyncSuccess] = useState(false);
  const [pushActionStatus, setPushActionStatus] = useState<string | null>(null);
  const [isPushLoading, setIsPushLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 2FA TOTP Factors State
  const [totpFactor, setTotpFactor] = useState<any | null>(null);
  const [isMfaLoading, setIsMfaLoading] = useState(false);
  const [mfaStatusMessage, setMfaStatusMessage] = useState<string | null>(null);

  // Settings form state
  const [currency, setCurrency] = useState(profile?.currency_preference || 'USD');
  const [annualBenchmark, setAnnualBenchmark] = useState<number>(
    profile?.annual_benchmark_percent || 16.7
  );
  const [categoryBenchmarks, setCategoryBenchmarks] = useState<Record<string, number>>(
    profile?.category_annual_benchmarks || {}
  );
  const [selectedOffsets, setSelectedOffsets] = useState<number[]>(
    profile?.default_reminder_days || [7, 3, 1]
  );
  const [notifyRenewals, setNotifyRenewals] = useState(
    profile?.notify_renewals !== false
  );
  const [notifyTrials, setNotifyTrials] = useState(
    profile?.notify_trials !== false
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    profile?.notifications_enabled !== false
  );
  const [isSaving, setIsSaving] = useState(false);
  const [highlightBenchmarks, setHighlightBenchmarks] = useState(false);

  const loadMfaFactors = React.useCallback(async () => {
    if (!user || !isConfigured) return;
    const supabase = createClient();
    if (!supabase) return;
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const totp = data?.totp?.[0];
      setTotpFactor(totp || null);
    } catch (err) {
      console.error('Error loading MFA factors:', err);
    }
  }, [user, isConfigured]);

  useEffect(() => {
    loadMfaFactors();
  }, [loadMfaFactors]);

  useEffect(() => {
    const handleHash = () => {
      if (typeof window !== 'undefined' && window.location.hash === '#category-benchmarks') {
        setShowAdvanced(true);
        setHighlightBenchmarks(true);
        const el = document.getElementById('category-benchmarks');
        if (el) {
          const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          el.scrollIntoView({
            behavior: isReducedMotion ? 'auto' : 'smooth',
            block: 'center',
          });
        }
        const timer = setTimeout(() => {
          setHighlightBenchmarks(false);
        }, 2800);
        return () => clearTimeout(timer);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const toggleOffset = (days: number) => {
    if (selectedOffsets.includes(days)) {
      setSelectedOffsets(selectedOffsets.filter((d) => d !== days));
    } else {
      setSelectedOffsets([...selectedOffsets, days].sort((a, b) => b - a));
    }
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateProfile({
        currency_preference: currency,
        annual_benchmark_percent: Number(annualBenchmark),
        category_annual_benchmarks: categoryBenchmarks,
        default_reminder_days: selectedOffsets,
        notifications_enabled: notificationsEnabled,
        notify_renewals: notifyRenewals,
        notify_trials: notifyTrials,
      });
      await updatePreferences({
        enabled: notificationsEnabled,
        notifyRenewals,
        notifyTrials,
        offsets: selectedOffsets,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePush = async () => {
    setIsPushLoading(true);
    setPushActionStatus(null);
    try {
      if (isPushSubscribed) {
        const res = await disablePushNotifications();
        if (res.success) {
          setPushActionStatus('Web push alerts disabled on this device.');
        } else {
          setPushActionStatus(res.error || 'Failed to disable push alerts.');
        }
      } else {
        const res = await enablePushNotifications();
        if (res.success) {
          setPushActionStatus('Web push alerts enabled on this device.');
        } else {
          setPushActionStatus(res.error || 'Permission not granted or push unavailable.');
        }
      }
    } catch (err: any) {
      setPushActionStatus(err.message || 'Error updating push status.');
    } finally {
      setIsPushLoading(false);
    }
  };

  const handleDisableMFA = async () => {
    if (!totpFactor?.id) return;
    if (!confirm('Are you sure you want to disable Two-Factor Authentication?')) return;

    setIsMfaLoading(true);
    setMfaStatusMessage(null);
    try {
      const res = await unenrollMFA(totpFactor.id);
      if (res.error) {
        setMfaStatusMessage(`Error: ${res.error}`);
      } else {
        setTotpFactor(null);
        setMfaStatusMessage('Two-Factor Authentication disabled.');
      }
    } catch (err: any) {
      setMfaStatusMessage(err?.message || 'Failed to remove 2FA.');
    } finally {
      setIsMfaLoading(false);
    }
  };

  const handleSyncRates = async () => {
    setIsSyncingRates(true);
    try {
      await refreshExchangeRates(true);
      setRatesSyncSuccess(true);
      setTimeout(() => setRatesSyncSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to sync rates:', err);
    } finally {
      setIsSyncingRates(false);
    }
  };

  const handleExportJSON = () => {
    const backup = generateFullBackupJson({
      userEmail: user?.email || 'local-user@sweep.app',
      profile,
      subscriptions,
      categories,
    });
    const jsonStr = JSON.stringify(backup, null, 2);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadFile(jsonStr, `sweep-backup-${dateStr}.json`, 'application/json');
  };

  const handleExportCSV = () => {
    const csvStr = generateSubscriptionsCsv(subscriptions);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadFile(csvStr, `sweep-subscriptions-${dateStr}.csv`, 'text/csv');
  };

  const handleExportPackage = () => {
    const backup = generateFullBackupJson({
      userEmail: user?.email || 'local-user@sweep.app',
      profile,
      subscriptions,
      categories,
    });
    const csvStr = generateSubscriptionsCsv(subscriptions);
    const readmeStr = generateBackupReadme(backup);
    const dateStr = new Date().toISOString().split('T')[0];

    downloadFile(JSON.stringify(backup, null, 2), `sweep-backup-${dateStr}.json`, 'application/json');
    setTimeout(() => {
      downloadFile(csvStr, `sweep-subscriptions-${dateStr}.csv`, 'text/csv');
    }, 200);
    setTimeout(() => {
      downloadFile(readmeStr, `README-sweep-backup-${dateStr}.txt`, 'text/plain');
    }, 400);
  };

  const handleDeleteAllData = async () => {
    setIsDeletingAll(true);
    try {
      await clearAllData();
      setIsDeleteAllModalOpen(false);
      window.location.href = '/';
    } catch (err) {
      console.error('Failed to delete all data:', err);
    } finally {
      setIsDeletingAll(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto pb-16">
      {/* Header */}
      <div className="pb-2 border-b border-border">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Currency, reminders, backups, and how Sweep looks.
        </p>
      </div>

      {/* Guests had no way to find sign in on mobile, so show it here for everyone */}
      {!user && isConfigured ? (
        <Card className="border-primary/25">
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-foreground">You are not signed in</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your subscriptions are saved only in this browser. Sign in to keep them safe and
                see them on your other devices.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ButtonLink href="/login" variant="primary" size="sm" className="gap-1.5 text-xs">
                <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                Sign in
              </ButtonLink>
              <ButtonLink href="/signup" variant="outline" size="sm" className="gap-1.5 text-xs">
                <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                Create an account
              </ButtonLink>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Save Success Alert */}
      {savedSuccess ? (
        <div className="p-3 text-xs bg-success-subtle border border-success/30 text-success rounded-lg flex items-center gap-2 animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Settings saved successfully.</span>
        </div>
      ) : null}

      {/* Restore Success Alert */}
      {restoreSuccess ? (
        <div className="p-3 text-xs bg-success-subtle border border-success/30 text-success rounded-lg flex items-center gap-2 animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Backup restored successfully. Your ledger has been updated.</span>
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* 1. GENERAL SECTION (Currency & Notifications) */}
      {/* ========================================================================= */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" />
            <CardTitle>General</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-0">
          <form onSubmit={handleSaveGeneral} className="space-y-5">
            {/* Currency Selector */}
            <div className="space-y-1.5">
              <label htmlFor="display-currency" className="block text-xs font-medium text-foreground">
                Display currency
              </label>
              <Select
                id="display-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                helperText="All your totals are shown in this currency."
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code} {c.symbol})
                  </option>
                ))}
              </Select>
            </div>

            {/* Notification Controls */}
            <div className="space-y-3 pt-3 border-t border-border/60">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-foreground block">
                    Renewal & Trial Alerts
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Get a reminder before you are charged.
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyRenewals}
                    onChange={(e) => setNotifyRenewals(e.target.checked)}
                    className="w-4 h-4 rounded text-primary border-border accent-primary"
                  />
                  <span>Remind me before a subscription renews</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyTrials}
                    onChange={(e) => setNotifyTrials(e.target.checked)}
                    className="w-4 h-4 rounded text-primary border-border accent-primary"
                  />
                  <span>Remind me before a free trial ends</span>
                </label>
              </div>

              {/* Reminder Offset Chips */}
              <div className="space-y-1.5 pt-2">
                <label className="text-[11px] font-medium text-muted-foreground block">
                  When to remind me
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {REMINDER_OFFSET_OPTIONS.map((opt) => {
                    const isSelected = selectedOffsets.includes(opt.days);
                    return (
                      <button
                        key={opt.days}
                        type="button"
                        onClick={() => toggleOffset(opt.days)}
                        className={cn(
                          'px-2.5 py-1 rounded-md border text-xs font-medium transition-all cursor-pointer',
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary font-semibold'
                            : 'border-border bg-surface text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Web Push Notification Toggle */}
              {isPushSupported ? (
                <div className="p-3 rounded-xl bg-surface/50 border border-border space-y-2 pt-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground">
                      Device Push Notifications
                    </span>
                    <Button
                      type="button"
                      variant={isPushSubscribed ? 'outline' : 'primary'}
                      size="sm"
                      onClick={handleTogglePush}
                      isLoading={isPushLoading}
                      className="text-xs h-7 px-2.5"
                    >
                      {isPushSubscribed ? 'Disable Push' : 'Enable Push'}
                    </Button>
                  </div>
                  {pushActionStatus && (
                    <p className="text-[11px] text-primary">{pushActionStatus}</p>
                  )}
                </div>
              ) : null}
            </div>

            {/* Demoted Advanced Settings Collapsible */}
            <div className="pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full py-1 text-xs font-medium text-muted-foreground hover:text-foreground flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>More settings (yearly discount, bank rules, sync)</span>
                {showAdvanced ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showAdvanced ? (
                <div className="space-y-4 pt-3 text-xs animate-in fade-in duration-150">
                  {/* Default Annual Benchmark */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-foreground">
                      Annual Plan Savings Benchmark
                    </label>
                    <Select
                      value={String(annualBenchmark)}
                      onChange={(e) => setAnnualBenchmark(Number(e.target.value))}
                    >
                      {ANNUAL_BENCHMARK_OPTIONS.map((b) => (
                        <option key={b.value} value={String(b.value)}>
                          {b.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {/* Category Benchmarks Table */}
                  <div
                    id="category-benchmarks"
                    className={cn(
                      'space-y-2 p-3 rounded-lg border transition-all',
                      highlightBenchmarks
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border bg-surface/30'
                    )}
                  >
                    <span className="font-medium text-foreground block">
                      Category Benchmark Overrides
                    </span>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {categories.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground truncate">{c.name}</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            placeholder={`${annualBenchmark}%`}
                            value={categoryBenchmarks[c.id] ?? ''}
                            onChange={(e) => {
                              const val = e.target.value ? Number(e.target.value) : undefined;
                              setCategoryBenchmarks((prev) => {
                                const next = { ...prev };
                                if (val === undefined) delete next[c.id];
                                else next[c.id] = val;
                                return next;
                              });
                            }}
                            className="sweep-input w-20 text-xs py-1 px-2 text-right"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Exchange Rates Sync */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface/40 border border-border">
                    <span className="text-muted-foreground">Manual Exchange Rates Sync</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSyncRates}
                      isLoading={isSyncingRates}
                      className="text-xs h-7 px-2"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Sync
                    </Button>
                  </div>

                  {/* Bank Rules */}
                  <CustomBankRulesManager />
                </div>
              ) : null}
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSaving}
                className="text-xs font-semibold shadow-xs"
              >
                Save General Settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* 2. PAYMENT METHODS & CARDS (WALLET) */}
      {/* ========================================================================= */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            <CardTitle>Payment Methods & Wallet</CardTitle>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAddPmModalOpen(true)}
            className="text-xs gap-1.5 shadow-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Payment Method</span>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 pt-0 text-xs">
          <p className="text-muted-foreground text-[11px]">
            The cards, bank accounts, and wallets you pay with.
          </p>

          {paymentMethods.length === 0 ? (
            <div className="p-4 rounded-xl bg-surface/50 border border-border text-center space-y-2">
              <p className="text-muted-foreground">
                No payment methods yet. Add one to see which card pays for what.
              </p>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setIsAddPmModalOpen(true)}
                className="text-xs gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Your First Payment Method
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {paymentMethods.map((pm) => (
                <div
                  key={pm.id}
                  className="p-3 rounded-xl bg-surface/50 border border-border flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <CreditCard className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {pm.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground capitalize">
                        {pm.type.replace('_', ' ')} {pm.last4 ? `(•••• ${pm.last4})` : ''}
                      </p>
                    </div>
                  </div>
                  {pm.is_default ? (
                    <Badge variant="success" size="sm" className="shrink-0">
                      Default
                    </Badge>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* 3. ACCOUNT & SECURITY (MFA / 2FA) */}
      {/* ========================================================================= */}
      {user ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <CardTitle>Account & Security</CardTitle>
            </div>
            <Badge variant="success" size="sm">
              Signed In
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4 pt-0 text-xs">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Authenticated Account</span>
              <span className="font-mono font-medium text-foreground">{user.email}</span>
            </div>

            {/* Two-Factor Authentication Box */}
            <div className="p-3.5 rounded-xl bg-surface/60 border border-border space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-foreground">
                    Two-Factor Authentication (TOTP)
                  </span>
                </div>
                <Badge variant={totpFactor ? 'success' : 'outline'} size="sm">
                  {totpFactor ? '2FA Enabled' : 'Not Active'}
                </Badge>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Add an extra layer of protection requiring a 6-digit code from your authenticator app on every sign-in.
              </p>

              {mfaStatusMessage ? (
                <p className="text-[11px] text-primary font-medium">{mfaStatusMessage}</p>
              ) : null}

              <div className="pt-1 flex items-center justify-end gap-2">
                <ButtonLink href="/settings/security" variant="outline" size="sm" className="text-xs h-8">
                  Change Password
                </ButtonLink>

                <ButtonLink href="/settings/mfa" variant={totpFactor ? 'outline' : 'primary'} size="sm" className="text-xs h-8 gap-1.5 shadow-xs">
                  <KeyRound className="w-3.5 h-3.5" />
                  {totpFactor ? 'Manage 2FA' : 'Set Up 2FA'}
                </ButtonLink>
              </div>
            </div>

            {/* Sign Out Action */}
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <span className="text-muted-foreground">Active authentication session</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => signOut()}
                className="text-xs text-danger hover:bg-danger-subtle gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ========================================================================= */}
      {/* 3. APPEARANCE SECTION */}
      {/* ========================================================================= */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" />
            <CardTitle>Appearance</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-foreground block">Theme Mode</span>
              <span className="text-muted-foreground text-[11px]">
                Light, dark, or match your device.
              </span>
            </div>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* 4. DATA SECTION (Export, Import, Prominent Restore, Delete All Data) */}
      {/* ========================================================================= */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            <CardTitle>Data & Portability</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0 text-xs">
          <p className="text-muted-foreground leading-relaxed">
            Download a copy of your data any time, or restore a backup you saved before.
          </p>

          {/* Prominent Trust Restore Hero Box */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="font-semibold text-foreground block flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-primary" />
                Restore From Backup
              </span>
              <p className="text-[11px] text-foreground/70 mt-0.5">
                Restore or merge a <code className="font-mono bg-surface px-1 py-0.2 rounded">sweep-backup-*.json</code> file.
              </p>
            </div>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setIsRestoreModalOpen(true)}
              className="text-xs font-semibold shadow-xs shrink-0 gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Restore Backup
            </Button>
          </div>

          {/* Export Action Buttons */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-medium text-muted-foreground block">
              Export Records
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportJSON}
                className="gap-1.5 text-xs justify-center"
              >
                <Download className="w-3.5 h-3.5 text-primary" />
                Full JSON
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="gap-1.5 text-xs justify-center"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
                CSV Table
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportPackage}
                className="gap-1.5 text-xs justify-center"
              >
                <Archive className="w-3.5 h-3.5 text-primary" />
                Backup Bundle
              </Button>
            </div>
          </div>

          {/* Statement Import Link */}
          <div className="pt-2 flex items-center justify-between border-t border-border/60">
            <span className="text-muted-foreground">Bank Statement Import</span>
            <ButtonLink href="/subscriptions/import" variant="outline" size="sm" className="text-xs gap-1">
              Open Importer <ExternalLink className="w-3 h-3" />
            </ButtonLink>
          </div>

          {/* Danger Zone: Delete All Data */}
          <div className="pt-4 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="font-semibold text-danger block flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5 text-danger" />
                Delete All Data
              </span>
              <span className="text-[11px] text-muted-foreground">
                Deletes all your subscriptions, categories, and settings. This cannot be undone.
              </span>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsDeleteAllModalOpen(true)}
              className="text-xs text-danger hover:bg-danger-subtle shrink-0"
            >
              Delete All Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 9. About Sweep */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            <CardTitle>About Sweep</CardTitle>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">v0.1.0 · PWA Ready</span>
        </CardHeader>
        <CardContent className="space-y-3.5 pt-0 text-xs text-muted-foreground leading-relaxed">
          {/* Privacy Note */}
          <div className="p-3 rounded-lg bg-surface/60 border border-border/60 space-y-1">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              Privacy-First & Local-First
            </span>
            <p className="text-[11px]">
              No ad trackers, no selling your data, and Sweep never asks for your bank login. Your data is yours.
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <Link
              href="/privacy"
              className="font-medium text-primary hover:underline flex items-center gap-1"
            >
              Privacy Policy <ExternalLink className="w-3 h-3" />
            </Link>
            <span className="text-[11px] text-muted-foreground">Build 2026.08</span>
          </div>

          {/* Rate Sweep / Feedback */}
          <div className="pt-3 border-t border-border/50 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground flex items-center gap-1">
              <Heart className="w-3 h-3 text-primary/70" />
              Enjoying Sweep?
            </span>
            <a
              href="https://github.com/SanghpalBhakte/Sweep"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground hover:underline"
            >
              Star on GitHub / Feedback
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Restore Modal */}
      <RestoreModal
        isOpen={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        onSuccess={() => {
          setRestoreSuccess(true);
          refresh();
          setTimeout(() => setRestoreSuccess(false), 4000);
        }}
      />

      {/* Delete All Data Strong Confirmation Dialog */}
      {isDeleteAllModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="sweep-card max-w-sm w-full p-5 space-y-4 shadow-xl border-danger/30">
            <div className="flex items-center gap-2.5 text-danger font-semibold text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Delete All Data?</span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              This will permanently erase all <strong>{subscriptions.length} subscriptions</strong>, custom categories, and saved settings from your device. This action cannot be reversed.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteAllModalOpen(false)}
                disabled={isDeletingAll}
                className="text-xs"
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleDeleteAllData}
                isLoading={isDeletingAll}
                className="text-xs bg-danger hover:bg-danger/90 border-transparent text-danger-foreground font-semibold"
              >
                Erase Everything
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <AddPaymentMethodModal
        isOpen={isAddPmModalOpen}
        onClose={() => setIsAddPmModalOpen(false)}
      />
    </div>
  );
}
