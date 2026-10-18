/** @type {import('next').NextConfig} */

// Build-time environment variable audit
function validateBuildEnv() {
  const issues = [];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl && !supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
    issues.push('NEXT_PUBLIC_SUPABASE_URL must be a valid URL starting with https:// or http://');
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && !appUrl.startsWith('http://') && !appUrl.startsWith('https://')) {
    issues.push('NEXT_PUBLIC_APP_URL must be a valid URL starting with https:// or http://');
  }

  if (process.env.VAPID_PRIVATE_KEY && !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    issues.push('VAPID_PRIVATE_KEY is present but NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing.');
  }

  if (issues.length > 0) {
    console.error('\n\u274c [Sweep Environment Validation Error]:');
    issues.forEach((err) => console.error(`  - ${err}`));
    console.error('');
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Build failed due to invalid environment variables:\n${issues.join('\n')}`);
    }
  }
}

validateBuildEnv();

/** @type {import('next').NextConfig} */
const securityHeaders = [
  // Block browsers from MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Prevent Sweep from being embedded in iframes (clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Enable HSTS — browsers will only connect via HTTPS for 1 year
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  // Control referrer info sent on navigation
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Restrict access to sensitive browser APIs
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // CSP. Scripts only from this site (Vercel Analytics is served from our own
  // domain). No *.vercel.app: anyone can host a script there. No unsafe-eval:
  // nothing in the app needs it (pdf.js runs with isEvalSupported: false).
  // 'unsafe-inline' stays for the small theme script that prevents a flash.
  {
    key: 'Content-Security-Policy',
    value: [
      `default-src 'self'`,
      `script-src 'self' 'unsafe-inline' https://vercel.live`,
      `style-src 'self' 'unsafe-inline'`,
      `font-src 'self' data:`,
      `img-src 'self' data: blob: https://*.supabase.co https://vercel.com`,
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com https://open.er-api.com https://api.frankfurter.dev https://vercel.live wss://ws-us3.pusher.com`,
      `worker-src 'self' blob:`,
      `manifest-src 'self'`,
      `frame-src https://vercel.live`,
      `object-src 'none'`,
      `frame-ancestors 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
    ].join('; '),
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        // Cache static icons and manifest assets aggressively
        source: '/icons/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', '@supabase/ssr', '@supabase/supabase-js'],
  },
};

export default nextConfig;
