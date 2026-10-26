import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWebPushToUser } from '@/lib/services/serverPushService';
import {
  buildPushPayload,
  findDueReminders,
  localDateAndHour,
  REMINDER_HOUR,
  ReminderSub,
} from '@/lib/utils/pushReminders';
import { formatCurrency } from '@/lib/utils/currency';

// Hourly from Supabase pg_cron (see 20261028010000_hourly_push_reminders.sql), with the
// daily Vercel cron at 03:30 UTC as a backup. Each person gets each reminder once, from
// 9 AM in their own timezone. A run that fails to reach any device gives the reminder
// back, so the next hour tries again.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Vercel cron and pg_cron send "Authorization: Bearer <CRON_SECRET>". x-cron-secret is for manual runs.
  return req.headers.get('authorization') === `Bearer ${secret}` || req.headers.get('x-cron-secret') === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return new Response('Unauthorized', { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set.' }, { status: 500 });
  }
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const now = new Date();
  const result = { users: 0, notYet: 0, due: 0, sent: 0, skipped: 0, failed: 0, cleaned: 0 };

  // Only people with at least one device turned on
  const { data: devices, error: devErr } = await db.from('push_subscriptions').select('user_id');
  if (devErr) return NextResponse.json({ error: devErr.message }, { status: 500 });
  const userIds = [...new Set((devices || []).map((d) => d.user_id as string))];
  if (userIds.length === 0) return NextResponse.json(result);

  const [{ data: profiles, error: profErr }, { data: subs, error: subErr }] = await Promise.all([
    db
      .from('profiles')
      .select('id, notifications_enabled, notify_renewals, notify_trials, default_reminder_days, timezone')
      .in('id', userIds),
    db
      .from('subscriptions')
      .select('id, user_id, name, amount, currency, billing_cycle, custom_interval_days, next_renewal_date, is_trial, trial_end_date, status, reminder_offsets')
      .in('user_id', userIds)
      .eq('status', 'active'),
  ]);
  // Without profiles we can't tell who turned reminders off, so send nothing
  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });
  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });

  const profileById = new Map((profiles || []).map((p) => [p.id as string, p]));

  for (const userId of userIds) {
    const profile = profileById.get(userId);
    if (profile?.notifications_enabled === false) continue;
    result.users++;

    const local = localDateAndHour(now, profile?.timezone);
    if (local.hour < REMINDER_HOUR) {
      result.notYet++;
      continue;
    }

    const due = findDueReminders(
      ((subs || []) as ReminderSub[]).filter((s) => s.user_id === userId),
      local.date,
      {
        renewals: profile?.notify_renewals !== false,
        trials: profile?.notify_trials !== false,
        defaultDays: profile?.default_reminder_days,
      }
    );
    result.due += due.length;

    for (const r of due) {
      // Claim it first. The unique key means only one run (pg_cron, Vercel or manual) wins.
      const { data: claimed, error: claimErr } = await db
        .from('reminders_sent')
        .upsert(
          { user_id: userId, subscription_id: r.sub.id, kind: r.kind, target_date: r.targetDate },
          { onConflict: 'subscription_id,kind,target_date', ignoreDuplicates: true }
        )
        .select('id');
      if (claimErr) {
        result.failed++;
        continue;
      }
      if (!claimed || claimed.length === 0) {
        result.skipped++;
        continue;
      }

      const push = await sendWebPushToUser(
        userId,
        buildPushPayload(r, formatCurrency(r.sub.amount, r.sub.currency || 'INR'))
      );
      result.cleaned += push.cleaned;
      if (push.sent === 0) {
        // No device took it (busy push service, 429, 5xx): give it back for the next run
        await db.from('reminders_sent').delete().eq('id', claimed[0].id);
        result.failed++;
        continue;
      }
      result.sent++;
    }
  }

  return NextResponse.json(result);
}
