'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/Card';
import { Separator } from '@/components/ui/Separator';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  ShieldCheck,
  QrCode,
  KeyRound,
  Check,
  Copy,
  AlertCircle,
  ArrowLeft,
  Trash2,
  Lock,
  CheckCircle2,
} from 'lucide-react';

export default function MFASettingsPage() {
  const { isConfigured } = useAuth();
  const [factors, setFactors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  // Enrollment state
  const [isEnrolling, setIsEnrolling] = useState<boolean>(false);
  const [enrollData, setEnrollData] = useState<{
    factorId: string;
    challengeId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Status/Alerts
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const verifiedTotpFactor = factors.find(
    (f) => f.factor_type === 'totp' && f.status === 'verified'
  );

  const fetchFactors = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) {
        setError(factorsError.message);
      } else if (data) {
        setFactors(data.totp || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to retrieve MFA factors.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFactors();
  }, [fetchFactors]);

  const handleStartEnroll = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsActionLoading(true);

    const supabase = createClient();
    if (!supabase) {
      setError('Supabase client unavailable.');
      setIsActionLoading(false);
      return;
    }

    try {
      // 1. Enroll TOTP Factor
      const { data: enrollRes, error: enrollErr } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator',
      });

      if (enrollErr || !enrollRes) {
        setError(enrollErr?.message || 'Failed to start MFA enrollment.');
        setIsActionLoading(false);
        return;
      }

      // 2. Create Challenge
      const { data: challengeRes, error: challengeErr } =
        await supabase.auth.mfa.challenge({ factorId: enrollRes.id });

      if (challengeErr || !challengeRes) {
        setError(challengeErr?.message || 'Failed to create verification challenge.');
        setIsActionLoading(false);
        return;
      }

      setEnrollData({
        factorId: enrollRes.id,
        challengeId: challengeRes.id,
        qrCode: enrollRes.totp.qr_code,
        secret: enrollRes.totp.secret,
      });
      setIsEnrolling(true);
    } catch (err: any) {
      setError(err?.message || 'An error occurred during enrollment.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleVerifyEnrollment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!enrollData || verifyCode.length !== 6) return;

    setError(null);
    setIsActionLoading(true);

    const supabase = createClient();
    if (!supabase) {
      setError('Supabase client unavailable.');
      setIsActionLoading(false);
      return;
    }

    try {
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: enrollData.factorId,
        challengeId: enrollData.challengeId,
        code: verifyCode,
      });

      if (verifyErr) {
        setError(
          verifyErr.message ||
            'Invalid 6-digit code. Please verify the code in your authenticator app.'
        );
        setIsActionLoading(false);
        return;
      }

      setSuccessMessage('Two-Factor Authentication (TOTP) successfully activated.');
      setIsEnrolling(false);
      setEnrollData(null);
      setVerifyCode('');
      await fetchFactors();
    } catch (err: any) {
      setError(err?.message || 'Failed to verify MFA enrollment.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUnenroll = async (factorId: string) => {
    if (
      !confirm(
        'Are you sure you want to remove this authenticator factor? Your account will no longer require 2FA on sign in.'
      )
    ) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsActionLoading(true);

    const supabase = createClient();
    if (!supabase) {
      setError('Supabase client unavailable.');
      setIsActionLoading(false);
      return;
    }

    try {
      const { error: unenrollErr } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrollErr) {
        setError(unenrollErr.message);
      } else {
        setSuccessMessage('Authenticator factor removed.');
        await fetchFactors();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to remove factor.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCopySecret = () => {
    if (!enrollData?.secret) return;
    navigator.clipboard.writeText(enrollData.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto py-2 pb-16">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Settings</span>
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-1">
            Two-Factor Authentication
          </h1>
        </div>

        <ButtonLink href="/settings/security" variant="outline" size="sm" className="text-xs">
          Password Security
        </ButtonLink>
      </div>

      {/* Success Alert */}
      {successMessage ? (
        <Alert variant="success" className="animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-success" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      {/* Error Alert */}
      {error ? (
        <Alert variant="destructive" className="animate-in fade-in duration-150">
          <AlertCircle className="w-4 h-4 shrink-0 text-danger" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <CardTitle>MFA Status</CardTitle>
                <CardDescription>
                  Time-based One-Time Password (TOTP)
                </CardDescription>
              </div>
            </div>

            {isLoading ? (
              <Skeleton className="h-5 w-20 rounded-badge" />
            ) : verifiedTotpFactor ? (
              <Badge variant="success" size="sm" className="gap-1">
                <Check className="w-3 h-3" />
                <span>Enabled</span>
              </Badge>
            ) : (
              <Badge variant="muted" size="sm">
                Not enabled
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-0 text-xs">
          <p className="text-muted-foreground leading-relaxed">
            Two-Factor Authentication protects your recurring subscriptions and financial data
            by requiring a 6-digit code from Google Authenticator, Authy, or 1Password every time
            you sign in.
          </p>

          <Separator />

          {isLoading ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : verifiedTotpFactor ? (
            /* Enrolled State */
            <div className="p-3.5 rounded-xl bg-surface/60 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-primary" />
                  <div>
                    <span className="font-semibold text-foreground block">
                      {verifiedTotpFactor.friendly_name || 'App Authenticator'}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Added on {new Date(verifiedTotpFactor.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <Badge variant="primary" size="sm">
                  Verified TOTP
                </Badge>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => handleUnenroll(verifiedTotpFactor.id)}
                  isLoading={isActionLoading}
                  className="text-xs gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Disable 2FA</span>
                </Button>
              </div>
            </div>
          ) : isEnrolling && enrollData ? (
            /* Enrollment Setup Box */
            <div className="p-4 rounded-xl bg-surface/50 border border-border space-y-4 animate-in fade-in duration-200">
              <div className="text-center space-y-1">
                <span className="font-semibold text-foreground text-sm block">
                  Scan QR Code
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Open your authenticator app (Google Authenticator, Authy) and scan this QR code:
                </p>
              </div>

              {/* QR Image */}
              <div className="flex justify-center p-3 bg-white rounded-lg w-fit mx-auto shadow-xs border border-border/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={enrollData.qrCode}
                  alt="MFA Setup QR Code"
                  className="w-44 h-44 object-contain"
                />
              </div>

              {/* Secret Key Text Fallback */}
              <div className="text-center space-y-1">
                <span className="text-[11px] text-muted-foreground block">
                  Can&apos;t scan? Enter this key manually into your app:
                </span>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-border font-mono text-xs text-foreground select-all">
                  <span>{enrollData.secret}</span>
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Copy Secret"
                  >
                    {copied ? (
                      <Check className="w-3 h-3 text-success" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              <Separator />

              {/* Confirmation Form */}
              <form onSubmit={handleVerifyEnrollment} className="space-y-3 max-w-xs mx-auto">
                <div className="space-y-1.5 text-center">
                  <label
                    htmlFor="verify-code"
                    className="block text-xs font-medium text-foreground"
                  >
                    Enter 6-Digit Code to Activate
                  </label>
                  <Input
                    id="verify-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={6}
                    value={verifyCode}
                    onChange={(e) =>
                      setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder="000000"
                    className="text-center text-xl tracking-[0.3em] font-mono font-bold py-2 bg-surface"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEnrolling(false);
                      setEnrollData(null);
                      setVerifyCode('');
                    }}
                    className="text-xs"
                  >
                    Cancel
                  </Button>

                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={verifyCode.length !== 6 || isActionLoading}
                    isLoading={isActionLoading}
                    className="text-xs font-semibold shadow-xs"
                  >
                    <Lock className="w-3.5 h-3.5 mr-1" />
                    Confirm & Activate
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            /* Not Enrolled State */
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-surface/40 border border-border">
              <div>
                <span className="font-semibold text-foreground block">
                  Add an extra layer of security
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Require an authenticator code whenever you log in.
                </span>
              </div>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleStartEnroll}
                isLoading={isActionLoading}
                className="text-xs gap-1.5 shadow-xs shrink-0"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Set Up Authenticator</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
