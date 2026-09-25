'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/utils/supabase/client';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { getSafeNext } from '@/lib/utils/safe-redirect';
import { ShieldCheck, AlertCircle, KeyRound, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

function MFAChallengeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get('next');
  const next = getSafeNext(rawNext, '/');

  const [factorId, setFactorId] = useState<string>('');
  const [challengeId, setChallengeId] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [hasNoFactor, setHasNoFactor] = useState<boolean>(false);

  const initMFAChallenge = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setHasNoFactor(false);

    if (!isSupabaseConfigured()) {
      router.replace(next);
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError('Supabase client unavailable.');
      setIsLoading(false);
      return;
    }

    try {
      // 1. Check current session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      // 2. Check assurance level
      const { data: aalData, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalError) {
        console.error('Error fetching AAL:', aalError);
      }

      // If user is already at aal2, proceed to destination
      if (aalData?.currentLevel === 'aal2') {
        router.replace(next);
        return;
      }

      // If user has not enrolled MFA (nextLevel is aal1), proceed normally
      if (aalData?.nextLevel === 'aal1') {
        router.replace(next);
        return;
      }

      // 3. Fetch factors
      const { data: factorsData, error: factorsError } =
        await supabase.auth.mfa.listFactors();

      if (factorsError) {
        setError(factorsError.message);
        setIsLoading(false);
        return;
      }

      // Find first verified TOTP factor, or fallback to first TOTP factor
      const totp =
        factorsData?.totp?.find((f) => f.status === 'verified') ||
        factorsData?.totp?.[0];

      if (!totp) {
        setHasNoFactor(true);
        setError('No active authenticator factor found for this account.');
        setIsLoading(false);
        return;
      }

      setFactorId(totp.id);

      // 4. Create challenge
      const challenge = await supabase.auth.mfa.challenge({ factorId: totp.id });
      if (challenge.error) {
        setError(challenge.error.message);
      } else if (challenge.data) {
        setChallengeId(challenge.data.id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to initialize MFA challenge.');
    } finally {
      setIsLoading(false);
    }
  }, [next, router]);

  useEffect(() => {
    initMFAChallenge();
  }, [initMFAChallenge]);

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (code.length !== 6 || isVerifying || !factorId || !challengeId) return;

    setError(null);
    setIsVerifying(true);

    const supabase = createClient();
    if (!supabase) {
      setError('Supabase client unavailable.');
      setIsVerifying(false);
      return;
    }

    try {
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code,
      });

      if (verifyError) {
        setError(
          verifyError.message ||
            'Invalid verification code. Please check your authenticator app and try again.'
        );
        setIsVerifying(false);
        return;
      }

      // MFA step-up successful -> navigate to safe destination
      router.replace(next);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || 'Verification failed. Please try again.');
      setIsVerifying(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(clean);

    // Auto-verify when 6 digits are entered
    if (clean.length === 6 && factorId && challengeId) {
      setTimeout(() => {
        const supabase = createClient();
        if (supabase) {
          setIsVerifying(true);
          setError(null);
          supabase.auth.mfa
            .verify({ factorId, challengeId, code: clean })
            .then(({ error: verifyError }) => {
              if (verifyError) {
                setError(verifyError.message || 'Invalid code.');
                setIsVerifying(false);
              } else {
                router.replace(next);
                router.refresh();
              }
            })
            .catch((err) => {
              setError(err?.message || 'Verification failed.');
              setIsVerifying(false);
            });
        }
      }, 50);
    }
  };

  return (
    <AuthShell
      title="Two-Factor Authentication"
      description="Enter the 6-digit verification code from your authenticator app to continue."
      icon={<ShieldCheck className="w-6 h-6" />}
      footer={
        <div className="flex items-center justify-between w-full text-xs">
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Sign in with another account</span>
          </Link>

          {!hasNoFactor ? (
            <button
              type="button"
              onClick={initMFAChallenge}
              disabled={isLoading || isVerifying}
              className="text-primary hover:underline font-medium flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Status Badge */}
        <div className="flex justify-center">
          <Badge variant="primary" size="sm" className="gap-1">
            <KeyRound className="w-3 h-3" />
            <span>AAL2 Verification Required</span>
          </Badge>
        </div>

        {/* Error Alert */}
        {error ? (
          <Alert variant="destructive" className="animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <AlertDescription className="flex-1">
              <p>{error}</p>
              {hasNoFactor ? (
                <div className="pt-2">
                  <ButtonLink href="/settings/mfa" variant="outline" size="xs">
                    Set up MFA in Settings
                  </ButtonLink>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={initMFAChallenge}
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-danger hover:underline cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Retry challenge
                </button>
              )}
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Verification Form */}
        {isLoading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="totp-code"
                className="block text-xs font-medium text-foreground text-center"
              >
                Security Code
              </label>
              <Input
                id="totp-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={code}
                onChange={handleCodeChange}
                disabled={isLoading || isVerifying || hasNoFactor}
                placeholder="000000"
                className="text-center text-2xl tracking-[0.35em] font-mono font-bold py-2.5 px-3 bg-surface"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={code.length !== 6 || isLoading || hasNoFactor}
              isLoading={isVerifying}
              className="w-full text-xs font-semibold shadow-xs"
            >
              <KeyRound className="w-3.5 h-3.5 mr-1.5" />
              Verify & Enter
            </Button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}

export default function MFAChallengePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center p-4">
          <div className="sweep-card max-w-sm w-full p-8 text-center space-y-3">
            <Skeleton className="h-10 w-10 rounded-full mx-auto" />
            <Skeleton className="h-4 w-32 mx-auto rounded" />
          </div>
        </div>
      }
    >
      <MFAChallengeForm />
    </Suspense>
  );
}
