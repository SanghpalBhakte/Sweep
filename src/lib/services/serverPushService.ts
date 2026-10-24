// =============================================================================
// Sift - Server-Side Web Push Dispatch Engine
// Path: src/lib/services/serverPushService.ts
// =============================================================================

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { getServerEnv, getPublicEnv } from '@/lib/env';

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

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  subscriptionId?: string;
}

export async function sendWebPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number; cleaned: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('Web Push skipped: VAPID keys not configured on server.');
    return { sent: 0, failed: 0, cleaned: 0 };
  }

  const supabaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    serverEnv.SUPABASE_SERVICE_ROLE_KEY ||
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey) {
    return { sent: 0, failed: 0, cleaned: 0 };
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Fetch active push subscriptions for this user
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId);

  if (error || !subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0, cleaned: 0 };
  }

  let sent = 0;
  let failed = 0;
  let cleaned = 0;

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    url: payload.url || '/home',
    tag: payload.tag || 'sweep-reminder',
  });

  for (const sub of subscriptions) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };

    try {
      await webpush.sendNotification(pushSubscription, notificationPayload);
      sent++;
    } catch (err: any) {
      failed++;
      // Auto-cleanup: If subscription has expired or unsubscribed (404 / 410 Gone)
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        cleaned++;
      }
    }
  }

  return { sent, failed, cleaned };
}
