import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWebPushToUser } from '@/lib/services/serverPushService';
import { findDueReminders, reminderText, todayInIndia, ReminderSub } from '@/lib/utils/pushReminders';
import { formatCurrency } from '@/lib/utils/currency';

// Daily at 03:30 UTC (9:00 AM IST), see vercel.json. Sends a push for each
// renewal or free trial ending on one of the user's reminder days, once each.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Vercel cron sends "Authorization: Bearer <CRON_SECRET>". x-cron-secret is for manual runs.
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

  const today = todayInIndia();
  const result = { today, users: 0, due: 0, sent: 0, skipped: 0, failed: 0, cleaned: 0 };

  // Only people with at least one device turned on
  const { data: devices, error: devErr } = await db.from('push_subscriptions').select('user_id');
  if (devErr) return NextResponse.json({ error: devErr.message }, { status: 500 });
  const userIds = [...new Set((devices || []).map((d) => d.user_id as string))];
  if (userIds.length === 0) return NextResponse.json(result);

  const [{ data: profiles }, { data: subs, error: subErr }] = await Promise.all([
    db.from('profiles').select('id, notifications_enabled, notify_renewals, notify_trials, default_reminder_days').in('id', userIds),
    db
      .from('subscriptions')
      .select('id, user_id, name, amount, currency, billing_cycle, custom_interval_days, next_renewal_date, is_trial, trial_end_date, status, reminder_offsets')
      .in('user_id', userIds)
      .eq('status', 'active'),
  ]);
  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });

  const profileById = new Map((profiles || []).map((p) => [p.id as string, p]));

  for (const userId of userIds) {
    const profile = profileById.get(userId);
    if (profile?.notifications_enabled === false) continue;
    result.users++;

    const due = findDueReminders(
      ((subs || []) as ReminderSub[]).filter((s) => s.user_id === userId),
      today,
      {
        renewals: profile?.notify_renewals !== false,
        trials: profile?.notify_trials !== false,
        defaultDays: profile?.default_reminder_days,
      }
    );
    if (due.length === 0) continue;
    result.due += due.length;

    const { data: already } = await db
      .from('reminders_sent')
      .select('subscription_id, kind, target_date')
      .eq('user_id', userId)
      .in('target_date', [...new Set(due.map((d) => d.targetDate))]);
    const sentKeys = new Set((already || []).map((r) => `${r.subscription_id}|${r.kind}|${r.target_date}`));

    for (const r of due) {
      if (sentKeys.has(`${r.sub.id}|${r.kind}|${r.targetDate}`)) {
        result.skipped++;
        continue;
      }
      const { title, body } = reminderText(r, formatCurrency(r.sub.amount, r.sub.currency || 'INR'));
      const push = await sendWebPushToUser(userId, {
        title,
        body,
        url: '/home',
        tag: `${r.kind}-${r.sub.id}`,
        subscriptionId: r.sub.id,
      });
      result.cleaned += push.cleaned;
      if (push.sent === 0) {
        result.failed++;
        continue;
      }
      result.sent++;
      await db.from('reminders_sent').insert({
        user_id: userId,
        subscription_id: r.sub.id,
        kind: r.kind,
        target_date: r.targetDate,
      });
    }
  }

  return NextResponse.json(result);
}
