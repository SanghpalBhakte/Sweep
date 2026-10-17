// =============================================================================
// Sweep - Schema-Validated Environment Helper
// Path: src/lib/env.ts
// =============================================================================

export interface ServerEnv {
  SUPABASE_SERVICE_ROLE_KEY?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT: string;
  CRON_SECRET?: string;
}

export interface PublicEnv {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_APP_URL: string;
  NEXT_PUBLIC_VAPID_PUBLIC_KEY?: string;
}

/**
 * Server-only environment variables.
 * Safe for use in Route Handlers, Server Components, and Background Services.
 */
export function getServerEnv(): ServerEnv {
  return {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || 'Sweep Reminders <onboarding@resend.dev>',
    // Production saved this key as "Vapidpvtkey" and Vercel cannot rename sensitive vars, so accept both.
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || process.env.Vapidpvtkey,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT || 'mailto:support@sweep.app',
    CRON_SECRET: process.env.CRON_SECRET,
  };
}

/**
 * Public client environment variables.
 */
export function getPublicEnv(): PublicEnv {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  };
}

/**
 * Status checks for optional service integrations
 */
export const serviceStatus = {
  isSupabaseConfigured: () =>
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  isResendConfigured: () => Boolean(process.env.RESEND_API_KEY),
  isWebPushConfigured: () =>
    Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && (process.env.VAPID_PRIVATE_KEY || process.env.Vapidpvtkey)),
  isCronConfigured: () => Boolean(process.env.CRON_SECRET),
};

/**
 * Build-time environment variable audit & validation.
 * Called during Next.js configuration initialization to warn or fail fast.
 */
export function validateEnvironment(options: { strict?: boolean } = {}) {
  const issues: string[] = [];

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
    const message = `[Environment Validation Error]:\n - ${issues.join('\n - ')}`;
    if (options.strict || process.env.NODE_ENV === 'production') {
      console.error(message);
      if (options.strict) {
        throw new Error(message);
      }
    } else {
      console.warn(message);
    }
  }

  return { valid: issues.length === 0, issues };
}
