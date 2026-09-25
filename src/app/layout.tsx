import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Fraunces } from 'next/font/google';
import './globals.css';
import { Providers } from '@/app/providers';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { SubscriptionProvider } from '@/context/SubscriptionContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { WebVitalsReporter } from '@/lib/utils/webVitals';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
  adjustFontFallback: true,
  variable: '--font-sans',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  preload: true,
  fallback: ['Georgia', 'serif'],
  adjustFontFallback: true,
  variable: '--font-fraunces',
});

const SITE_URL = 'https://sift-sand.vercel.app';
const SITE_TITLE = 'Sweep: Keep track of your subscriptions';
const SITE_DESCRIPTION =
  'Put all your subscriptions in one place. Get a reminder before something renews or a free trial ends, and see how much you spend each month.';
const OG_IMAGE = {
  url: '/og-image.png',
  width: 1200,
  height: 630,
  alt: 'Sweep logo with the text: Keep track of your subscriptions',
  type: 'image/png',
};

// Runs before the first paint so the page never flashes the wrong theme.
// Keep the storage keys in sync with ThemeContext.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('sweep_theme_preference')||localStorage.getItem('sift_theme_preference');if(t!=='paper-ledger'&&t!=='night-shelf'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'night-shelf':'paper-ledger';}var r=document.documentElement;if(t==='night-shelf'){r.classList.add('dark');}else{r.classList.remove('dark');}r.setAttribute('data-theme',t);}catch(e){}})();`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: 'Sweep',
  alternates: {
    canonical: './',
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/icons/favicon.svg',
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Sweep',
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: './',
    siteName: 'Sweep',
    images: [OG_IMAGE],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F1E8' },
    { media: '(prefers-color-scheme: dark)', color: '#191516' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let supabaseOrigin: string | null = null;
  if (supabaseUrl && (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://'))) {
    try {
      supabaseOrigin = new URL(supabaseUrl).origin;
    } catch {
      // Ignore invalid URL
    }
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {supabaseOrigin && (
          <>
            <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={supabaseOrigin} />
          </>
        )}
      </head>
      <body
        suppressHydrationWarning
        className={`${plusJakartaSans.variable} ${fraunces.variable} font-sans antialiased min-h-screen bg-background text-foreground`}
      >
        <Providers>
          <ThemeProvider>
            <AuthProvider>
              <SubscriptionProvider>
                <NotificationProvider>{children}</NotificationProvider>
              </SubscriptionProvider>
            </AuthProvider>
          </ThemeProvider>
        </Providers>
        <Analytics />
        <SpeedInsights />
        <WebVitalsReporter />
      </body>
    </html>
  );
}
