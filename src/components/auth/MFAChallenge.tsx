'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { ShieldCheck, AlertCircle, KeyRound, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface MFAChallengeProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

export function MFAChallenge({ onSuccess, onCancel }: MFAChallengeProps) {
  const [factorId, setFactorId] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);

  const initChallenge = async () => {
    setIsLoading(true);
    setError(null);
    const supabase = createClient();
    if (!supabase) {
      setError('Supabase client unavailable.');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) {
        setError(factorsError.message);
        setIsLoading(false);
        return;
      }

      const totp = data?.totp?.[0];
      if (!totp) {
        setError('No active authenticator factor found for this account.');
        setIsLoading(false);
        return;
      }

      setFactorId(totp.id);

      const challenge = await supabase.auth.mfa.challenge({ factorId: totp.id });
      if (challenge.error) {
        setError(challenge.error.message);
      } else if (challenge.data) {
        setChallengeId(challenge.data.id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to initialize 2FA challenge.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initChallenge();
  }, []);

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
        setError(verifyError.message || 'Invalid authentication code. Please try again.');
        setIsVerifying(false);
        return;
      }

      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Verification failed.');
      setIsVerifying(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(clean);
    if (clean.length === 6 && factorId && challengeId) {
      // Auto-submit on 6 digits
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
                onSuccess();
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
    <Card className="sweep-card max-w-sm w-full mx-auto p-6 space-y-5 shadow-md border-border">
      <CardHeader className="p-0 text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <CardTitle className="font-serif text-xl font-bold tracking-tight text-foreground">
          Two-factor authentication
        </CardTitle>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Enter the 6-digit security code from your Google Authenticator or TOTP app.
        </p>
      </CardHeader>

      <CardContent className="p-0 space-y-4">
        {error ? (
          <div className="p-3 text-xs bg-danger-subtle border border-danger/30 text-danger rounded-lg flex items-start gap-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{error}</p>
              {!factorId || !challengeId ? (
                <button
                  type="button"
                  onClick={initChallenge}
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-danger hover:underline cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Retry challenge
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground text-center">
              Security code
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={code}
                onChange={handleCodeChange}
                disabled={isLoading || isVerifying}
                placeholder="000000"
                className="sweep-input w-full text-center text-2xl tracking-[0.35em] font-mono font-bold py-2.5 px-3 bg-surface"
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={code.length !== 6 || isLoading}
            isLoading={isVerifying}
            className="w-full text-xs font-semibold shadow-xs"
          >
            <KeyRound className="w-3.5 h-3.5 mr-1.5" />
            Verify & sign in
          </Button>
        </form>

        <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
          ) : (
            <Link
              href="/login"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" /> Back to sign in
            </Link>
          )}

          <button
            type="button"
            onClick={initChallenge}
            disabled={isLoading || isVerifying}
            className="text-primary hover:underline text-[11px] font-medium flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> Refresh code
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
