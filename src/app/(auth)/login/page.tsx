'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { getSafeNext } from '@/lib/utils/safe-redirect';
import { CheckCircle2, AlertCircle, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const GOOGLE_AUTH_ON = process.env.NEXT_PUBLIC_GOOGLE_AUTH === 'on';
// Magic links need a custom SMTP server in Supabase: the built-in mailer only
// delivers to the project's own team. Set NEXT_PUBLIC_EMAIL_LINKS=on in Vercel
// once SMTP is set up; until then only password and Google show.
const EMAIL_LINKS_ON = process.env.NEXT_PUBLIC_EMAIL_LINKS === 'on';

function GoogleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get('next');
  const next = getSafeNext(rawNext, '/home');
  const authErrorParam = searchParams.get('error');

  const { signInWithPassword, signInWithOtp, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(
    // A magic link only works in the browser that asked for it (Supabase keeps a
    // one-time key there), so say how to get past it instead of "invalid link"
    authErrorParam !== 'auth-failed'
      ? null
      : EMAIL_LINKS_ON
      ? 'That sign-in link didn\'t work. Links only work in the same browser or app you asked from, and only once. Send a new one below, or sign in with your password.'
      : 'That sign-in didn\'t work. Please try again.'
  );
  // Came back from a failed link: the fix is a new link, so start on that tab
  const [authMode, setAuthMode] = useState<'password' | 'otp'>(
    EMAIL_LINKS_ON && authErrorParam === 'auth-failed' ? 'otp' : 'password'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setError(null);
    setIsSubmitting(true);

    if (authMode === 'password') {
      if (!password) {
        setError('Please enter your password.');
        setIsSubmitting(false);
        return;
      }
      const res = await signInWithPassword(email, password, next);
      if (res.error) {
        setError(res.error);
        setIsSubmitting(false);
      }
    } else {
      const res = await signInWithOtp(email);
      if (res.error) {
        setError(res.error);
        setIsSubmitting(false);
      } else {
        setIsOtpSent(true);
        setIsSubmitting(false);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);
    const res = await signInWithGoogle(next);
    if (res.error) {
      setError(res.error);
      setIsGoogleLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back to Sweep"
      description="Sign in to see your subscriptions on any device."
      icon={<LogIn className="w-6 h-6" />}
      footer={
        <div className="text-center text-xs text-muted-foreground w-full">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="tap font-medium text-primary hover:underline">
            Sign up
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Google sign-in shows only once the Google provider is set up in Supabase
            (set NEXT_PUBLIC_GOOGLE_AUTH=on in Vercel), so users never hit a dead button */}
        {GOOGLE_AUTH_ON ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              isLoading={isGoogleLoading}
              className="w-full flex items-center justify-center gap-2 text-xs font-medium bg-surface hover:bg-surface-muted"
            >
              <GoogleIcon className="w-4 h-4" />
              <span>Continue with Google</span>
            </Button>

            <div className="relative flex items-center justify-center py-1">
              <div className="absolute inset-x-0 top-1/2 border-t border-border" />
              <span className="relative bg-card px-2 text-[11px] text-muted-foreground uppercase tracking-wider">
                or
              </span>
            </div>
          </>
        ) : null}

        {/* Mode Switcher */}
        {EMAIL_LINKS_ON ? (
          <div className="grid grid-cols-2 p-1 bg-surface border border-border rounded-lg text-xs">
            <button
              type="button"
              onClick={() => {
                setAuthMode('password');
                setError(null);
              }}
              className={cn(
                'py-1.5 max-md:min-h-[44px] font-medium rounded-md transition-all cursor-pointer',
                authMode === 'password'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('otp');
                setError(null);
              }}
              className={cn(
                'py-1.5 max-md:min-h-[44px] font-medium rounded-md transition-all cursor-pointer',
                authMode === 'otp'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Magic link
            </button>
          </div>
        ) : null}

        {isOtpSent ? (
          <div className="text-center py-3 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-success mx-auto" />
            <h3 className="text-sm font-semibold text-foreground">
              Check your inbox
            </h3>
            <p className="text-xs text-muted-foreground">
              We sent a secure magic sign-in link to <strong>{email}</strong>.
            </p>
            <p className="text-[11px] text-muted-foreground">
              Open it on this device, in this same browser or app.
            </p>
            <button
              type="button"
              onClick={() => setIsOtpSent(false)}
              className="tap text-xs text-primary hover:underline cursor-pointer"
            >
              Sign in with password instead
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {error ? (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Input
              label="Email address"
              type="email"
              placeholder="name@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />

            {authMode === 'password' ? (
              <>
                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                {EMAIL_LINKS_ON ? (
                  <div className="flex justify-end -mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('otp');
                        setError(null);
                      }}
                      className="tap text-[11px] text-muted-foreground hover:text-primary cursor-pointer transition-colors"
                    >
                      Forgot password? Sign in with magic link
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              className="w-full shadow-xs text-xs font-semibold"
              isLoading={isSubmitting}
            >
              {authMode === 'password' ? 'Sign In' : 'Send Magic Link'}
            </Button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center p-4">
          <div className="sweep-card max-w-sm w-full p-8 text-center space-y-3">
            <div className="h-8 w-8 rounded-full bg-surface-muted mx-auto animate-pulse" />
            <div className="h-4 w-32 bg-surface-muted mx-auto rounded animate-pulse" />
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
