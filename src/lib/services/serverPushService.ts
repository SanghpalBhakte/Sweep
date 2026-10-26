// =============================================================================
// Sift - Server-Side Web Push Dispatch Engine
// Path: src/lib/services/serverPushService.ts
// =============================================================================

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { getServerEnv, getPublicEnv } from '@/lib/env';
import { isAllowedPushEndpoint, pushHost } from '@/lib/utils/pushEndpoint';
import { REMINDER_TTL_SECONDS, type PushPayload } from '@/lib/utils/pushReminders';

// Note on VAPID Security:
// NEXT_PUBLIC_VAPID_PUBLIC_KEY is public for browser PushManager.subscribe().
// VAPID_PRIVATE_KEY is strictly server-only for signing outgoing push notification payloads.
const serverEnv = getServerEnv();
const publicEnv = getPublicEnv();

const VAPID_PUBLIC_KEY = publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = serverEnv.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = serverEnv.VAPID_SUBJECT;

// Configure Web Push with VAPID credentials if present
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (err) {
    console.error('Failed to initialize Web Push VAPID details:', err);
  }
}

/** A refused push, described without ids, keys or notification text. */
export function describePushRefusal(err: { statusCode?: number; body?: unknown; endpoint?: string }): {
  status: number | null;
  host: string;
  reason: string;
} {
  let reason = '';
  if (typeof err.body === 'string' && err.body.trim()) {
    try {
      // Apple answers {"reason":"BadDeviceToken"}; FCM and others answer plain text
      const parsed = JSON.parse(err.body);
      reason = typeof parsed?.reason === 'string' ? parsed.reason : '';
    } catch {
      reason = err.body.trim().replace(/\s+/g, ' ').slice(0, 160);
    }
  }
  return { status: typeof err.statusCode === 'number' ? err.statusCode : null, host: pushHost(err.endpoint || ''), reason };
}

/** 404 and 410 mean the subscription is gone for good. Everything else might be ours or temporary. */
export function isGoneForGood(status: number | null): boolean {
  return status === 404 || status === 410;
}

export async function sendWebPushToUser(
  userId: string,
  payload: PushPayload,
  opts: { endpoint?: string; ttlSeconds?: number; urgency?: 'normal' | 'high' } = {}
): Promise<{ sent: number; failed: number; cleaned: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('Web Push skipped: VAPID keys not configured on server.');
    return { sent: 0, failed: 0, cleaned: 0 };
  }

  const supabaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = serverEnv.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return { sent: 0, failed: 0, cleaned: 0 };
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Fetch active push subscriptions for this user
  // With an endpoint, only that one device gets it (the settings test button)
  let query = supabase.from('push_subscriptions').select('*').eq('user_id', userId);
  if (opts.endpoint) query = query.eq('endpoint', opts.endpoint);
  const { data: subscriptions, error } = await query;

  if (error || !subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0, cleaned: 0 };
  }

  let sent = 0;
  let failed = 0;
  let cleaned = 0;

  // Flat, and only what the notification shows. The service worker adds the icon and badge.
  const body = JSON.stringify({ title: payload.title, body: payload.body, tag: payload.tag, url: payload.url });

  for (const sub of subscriptions) {
    if (!isAllowedPushEndpoint(sub.endpoint)) {
      console.warn('[push] skipped endpoint outside the allow-list', { host: pushHost(sub.endpoint) });
      failed++;
      continue;
    }

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body,
        { TTL: opts.ttlSeconds ?? REMINDER_TTL_SECONDS, urgency: opts.urgency ?? 'normal' }
      );
      sent++;
    } catch (err: any) {
      failed++;
      const refusal = describePushRefusal({ statusCode: err?.statusCode, body: err?.body, endpoint: sub.endpoint });
      console.warn('[push] refused', refusal);
      if (isGoneForGood(refusal.status)) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        cleaned++;
      }
    }
  }

  return { sent, failed, cleaned };
}
