import React from 'react';
import Link from 'next/link';
import { ArrowRight, Bell, IndianRupee, UploadCloud } from 'lucide-react';
import { SweepLogo } from '@/components/brand/SweepLogo';
import { ButtonLink } from '@/components/ui/Button';

// Plain HTML at build time so crawlers and link previews see the pitch.
// The app itself lives at /home; signed-in users get redirected there by middleware.
export const dynamic = 'force-static';

const POINTS = [
  { icon: Bell, text: 'Get a reminder before something renews or a free trial ends.' },
  { icon: IndianRupee, text: 'See what you spend each month, all in one number.' },
  { icon: UploadCloud, text: 'Add things by hand or pull them from a bank statement.' },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-background text-foreground">
      <div className="w-full max-w-md text-center">
        <div className="flex flex-col items-center">
          <SweepLogo variant="icon" size="lg" className="mb-4 shadow-sm" />
          <p className="font-serif text-xl tracking-tight text-foreground/80">Sweep</p>
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight mt-6">
          Keep track of your subscriptions
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-3 leading-relaxed">
          Netflix, Spotify, that free trial you forgot about. Put them all in one place so
          nothing renews without you knowing.
        </p>

        <ul className="sweep-card text-left mt-8 p-5 space-y-4">
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm">
              <Icon className="w-4 h-4 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
              <span>{text}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8 space-y-3">
          <ButtonLink
            href="/home"
            variant="primary"
            size="lg"
            className="w-full justify-center text-sm font-medium shadow-xs py-2.5 gap-2"
          >
            Open the app
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </ButtonLink>
          <p className="text-sm text-muted-foreground">
            Free to use. Already have an account?{' '}
            <Link
              href="/login"
              className="inline-flex items-center min-h-[44px] font-semibold text-foreground underline underline-offset-4"
            >
              Sign in
            </Link>
          </p>
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy
          </Link>
        </p>
      </div>
    </main>
  );
}
