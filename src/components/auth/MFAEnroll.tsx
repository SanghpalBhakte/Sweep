'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { ShieldCheck, AlertCircle, KeyRound, Copy, Check, QrCode, ArrowLeft } from 'lucide-react';

interface MFAEnrollProps {
  onEnrolled: () => void;
  onCancel?: () => void;
}

export function MFAEnroll({ onEnrolled, onCancel }: MFAEnrollProps) {
  const [qr, setQr] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [factorId, setFactorId] = useState<string>('');
  const [challengeId, setChallengeId] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function enrollTOTP() {
      setIsLoading(true);
      setError(null);

      const supabase = createClient();
      if (!supabase) {
        if (isMounted) {
          setError('Supabase client unavailable.');
          setIsLoading(false);
        }
        return;
      }

      try {
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          issuer: 'Sweep',
        });

        if (enrollError || !data) {
          if (isMounted) {
            setError(enrollError?.message || 'Failed to initialize 2FA enrollment.');
            setIsLoading(false);
          }
          return;
        }

        if (isMounted) {
          setFactorId(data.id);
          setQr(data.totp.qr_code);
          setSecret(data.totp.secret);
        }

        const challenge = await supabase.auth.mfa.challenge({ factorId: data.id });
        if (isMounted) {
          if (challenge.error) {
            setError(challenge.error.message);
          } else if (challenge.data) {
            setChallengeId(challenge.data.id);
          }
          setIsLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Enrollment setup error.');
          setIsLoading(false);
        }
      }
    }

    enrollTOTP();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopySecret = () => {
    if (!secret) return;
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

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
        setError(verifyError.message || 'Invalid confirmation code. Please check your app and try again.');
        setIsVerifying(false);
        return;
      }

      onEnrolled();
    } catch (err: any) {
      setError(err?.message || 'Verification failed.');
      setIsVerifying(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(clean);
  };

  return (
    <Card className="sweep-card max-w-md w-full mx-auto p-6 space-y-5 shadow-md border-border">
      <CardHeader className="p-0 text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
          <QrCode className="w-6 h-6" />
        </div>
        <CardTitle className="font-serif text-xl font-bold tracking-tight text-foreground">
          Set up Two-factor authentication
        </CardTitle>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Scan the QR code with Google Authenticator, Authy, or 1Password to protect your recurring ledger.
        </p>
      </CardHeader>

      <CardContent className="p-0 space-y-4">
        {error ? (
          <div className="p-3 text-xs bg-danger-subtle border border-danger/30 text-danger rounded-lg flex items-start gap-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="flex-1">{error}</p>
          </div>
        ) : null}

        {/* QR Code Presentation */}
        <div className="flex flex-col items-center justify-center p-4 bg-surface rounded-xl border border-border space-y-3">
          {isLoading ? (
            <div className="w-48 h-48 rounded-lg bg-surface-muted animate-pulse flex items-center justify-center text-xs text-muted-foreground">
              Generating secure QR...
            </div>
          ) : qr ? (
            <div className="p-2 bg-white rounded-lg shadow-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr}
                alt="2FA TOTP QR Code"
                className="w-44 h-44 sm:w-48 sm:h-48 object-contain"
              />
            </div>
          ) : null}

          {/* Secret Manual Key */}
          {secret ? (
            <div className="w-full text-center space-y-1">
              <span className="text-[11px] text-muted-foreground block">
                Can&apos;t scan? Enter key manually:
              </span>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-muted border border-border text-xs font-mono text-foreground select-all">
                <span>{secret}</span>
                <button
                  type="button"
                  onClick={handleCopySecret}
                  className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Copy secret key"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-success" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Activation Verification Form */}
        <form onSubmit={handleVerify} className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground text-center">
              Enter 6-Digit Code from Authenticator
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={handleCodeChange}
              disabled={isLoading || isVerifying}
              placeholder="000000"
              className="sweep-input w-full text-center text-xl tracking-[0.3em] font-mono font-bold py-2 px-3 bg-surface"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={code.length !== 6 || isLoading}
            isLoading={isVerifying}
            className="w-full text-xs font-semibold shadow-xs"
          >
            <ShieldCheck className="w-4 h-4 mr-1.5" />
            Activate 2FA
          </Button>
        </form>

        {onCancel ? (
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Cancel setup
            </button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
