import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js';
import { subscriptionService } from '@/lib/services/subscriptionService';
import { deriveAppAlerts } from '@/lib/utils/reminders';
import { formatCurrency } from '@/lib/utils/currency';
import { rollForwardRenewalDate } from '@/lib/utils/dates';
import { sendWebPushToUser } from '@/lib/services/serverPushService';
import { getServerEnv } from '@/lib/env';
import { sendEmail, emailProvider, escapeHtml } from '@/lib/services/emailService';

// ---------------------------------------------------------------------------
// Shared dispatch logic
// ---------------------------------------------------------------------------
async function runDispatch(targetUser: { id: string; email: string }, supabase: SupabaseClient<any>) {

  const { data: profile } = await (supabase.from('profiles') as any)
    .select('*')
    .eq('id', targetUser.id)
    .maybeSingle();

  const { data: subscriptionsData } = await (supabase.from('subscriptions') as any)
    .select('*, category:categories(*), payment_method:payment_methods(*)')
    .eq('user_id', targetUser.id)
    .eq('status', 'active');

  const subscriptions = subscriptionsData || [];

  // Move past renewal dates to the next cycle and save them, otherwise a
  // subscription drops out of reminders forever once its date passes.
  for (const sub of subscriptions) {
    if (sub.is_trial || !sub.next_renewal_date) continue;
    const next = rollForwardRenewalDate(sub.next_renewal_date, sub.billing_cycle, sub.custom_interval_days);
    if (next !== sub.next_renewal_date) {
      sub.next_renewal_date = next;
      await (supabase.from('subscriptions') as any)
        .update({ next_renewal_date: next })
        .eq('id', sub.id)
        .eq('user_id', targetUser.id);
    }
  }

  const profileOffsets: number[] = profile?.default_reminder_days || [7, 3, 1];

  // User turned reminders off completely: send nothing.
  const allAlerts =
    profile?.notifications_enabled === false
      ? []
      : deriveAppAlerts(subscriptions, {
          enabled: true,
          notifyRenewals: profile?.notify_renewals !== false,
          notifyTrials: profile?.notify_trials !== false,
          offsets: profileOffsets,
        });

  // deriveAppAlerts returns everything in the next 7 days (for the in-app bell).
  // Emails only go out on the days the user picked, plus the day itself.
  const offsetsById = new Map<string, number[]>(
    subscriptions.map((s: { id: string; reminder_offsets?: number[] | null }) => [
      s.id,
      s.reminder_offsets && s.reminder_offsets.length ? s.reminder_offsets : profileOffsets,
    ])
  );
  const alerts = allAlerts.filter((a) => {
    if (a.daysUntil === 0) return true;
    return (offsetsById.get(a.subscriptionId) || profileOffsets).includes(a.daysUntil);
  });

  const results = {
    userEmail: targetUser.email,
    totalDueAlerts: alerts.length,
    sent: 0,
    pushSent: 0,
    skipped: 0,
    failed: 0,
    dispatches: [] as any[],
  };

  for (const alert of alerts) {
    let existingLog = null;
    try {
      const { data } = await (supabase.from('reminder_dispatch_logs') as any)
        .select('id')
        .eq('subscription_id', alert.subscriptionId)
        .eq('reminder_type', alert.isTrial ? 'trial_expiry' : 'renewal')
        .eq('target_date', alert.targetDate)
        .eq('offset_days', alert.daysUntil)
        .eq('status', 'sent')
        .maybeSingle();
      existingLog = data;
    } catch {
      // Graceful fallback if reminder_dispatch_logs table does not exist
      existingLog = null;
    }

    if (!existingLog) {
      let emailDispatched = false;
      let pushDispatched = false;
      let dispatchError: string | null = null;

      // 1. Send the email (Gmail or Resend, see emailService)
      if (emailProvider()) {
        try {
          const subject =
            alert.daysUntil === 0
              ? `${alert.subscriptionName} renews today (${formatCurrency(alert.amount, alert.currency)})`
              : alert.isTrial
              ? `Your ${alert.subscriptionName} free trial ends in ${alert.daysUntil} ${alert.daysUntil === 1 ? 'day' : 'days'}`
              : `${alert.subscriptionName} renews in ${alert.daysUntil} ${alert.daysUntil === 1 ? 'day' : 'days'}`;

          const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; color: #24201E; background: #F6F1E8; border-radius: 12px; border: 1px solid #D8CFC4;">
              <div style="margin-bottom: 20px; font-size: 14px; font-weight: 700; color: #5B294A; letter-spacing: -0.01em;">
                SWEEP
              </div>
              <h2 style="font-size: 18px; margin: 0 0 12px 0; color: #24201E;">${escapeHtml(alert.title)}</h2>
              <p style="font-size: 14px; line-height: 1.6; color: #756D65; margin: 0 0 20px 0;">${escapeHtml(alert.message)}</p>
              <div style="background: #FCF9F3; padding: 16px; border-radius: 8px; border: 1px solid #D8CFC4; margin-bottom: 24px;">
                <table style="width: 100%; font-size: 13px;">
                  <tr>
                    <td style="color: #756D65; padding-bottom: 6px;">Service:</td>
                    <td style="font-weight: 600; text-align: right; padding-bottom: 6px;">${escapeHtml(alert.subscriptionName)}</td>
                  </tr>
                  <tr>
                    <td style="color: #756D65; padding-bottom: 6px;">Amount:</td>
                    <td style="font-weight: 600; text-align: right; padding-bottom: 6px; font-family: monospace;">${formatCurrency(alert.amount, alert.currency)}</td>
                  </tr>
                  <tr>
                    <td style="color: #756D65;">Date:</td>
                    <td style="font-weight: 600; text-align: right;">${alert.targetDate}</td>
                  </tr>
                </table>
              </div>
              ${
                alert.cancelUrl
                  ? `<div style="text-align: center; margin-bottom: 20px;">
                      <a href="${escapeHtml(alert.cancelUrl)}" style="display: inline-block; background: #5B294A; color: #FCF9F3; padding: 10px 20px; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none;">Manage or cancel</a>
                     </div>`
                  : ''
              }
              <div style="font-size: 11px; color: #756D65; text-align: center; border-top: 1px solid #D8CFC4; padding-top: 16px;">
                Sent by Sweep because you turned on reminders.
              </div>
            </div>
          `;

          const sent = await sendEmail({ to: targetUser.email, subject, html });
          if (sent.ok) {
            emailDispatched = true;
          } else {
            dispatchError = sent.error;
          }
        } catch (err: any) {
          dispatchError = `Email network error: ${err.message}`;
        }
      }

      // 2. Dispatch Native Web Push Alert
      try {
        const pushRes = await sendWebPushToUser(targetUser.id, {
          title: alert.title,
          body: `${alert.subscriptionName}: ${formatCurrency(alert.amount, alert.currency)} due on ${alert.targetDate}`,
          url: `/subscriptions/${alert.subscriptionId}/edit`,
          tag: `renewal-${alert.subscriptionId}`,
          subscriptionId: alert.subscriptionId,
        });
        if (pushRes.sent > 0) {
          pushDispatched = true;
        }
      } catch (err: any) {
        console.warn('Web push dispatch error:', err);
      }

      // 3. Record dispatch log
      const status = emailDispatched || pushDispatched ? 'sent' : 'failed';
      try {
        await (supabase.from('reminder_dispatch_logs') as any).insert({
          user_id: targetUser.id,
          subscription_id: alert.subscriptionId,
          reminder_type: alert.isTrial ? 'trial_expiry' : 'renewal',
          target_date: alert.targetDate,
          offset_days: alert.daysUntil,
          recipient_email: targetUser.email,
          status,
          error_message: dispatchError,
        });
      } catch (logErr) {
        console.warn('Could not record reminder_dispatch_log:', logErr);
      }

      if (emailDispatched) results.sent++;
      if (pushDispatched) results.pushSent++;
      if (!emailDispatched && !pushDispatched) results.failed++;

      results.dispatches.push({
        subscriptionName: alert.subscriptionName,
        emailDispatched,
        pushDispatched,
        error: dispatchError,
      });
    } else {
      results.skipped++;
    }
  }

  return NextResponse.json({ success: true, results });
}

// ---------------------------------------------------------------------------
// GET — Vercel Cron entrypoint
// Vercel injects: Authorization: Bearer <CRON_SECRET>
// This handler HARD-REJECTS if the secret is absent or mismatched.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const serverEnv = getServerEnv();

    // No email provider is fine: push notifications still go out, and the
    // logs record the email error so it is easy to spot.

    // The cron call has no user cookies, so the normal RLS client would see zero rows
    // and nothing would ever be sent. Use the service role key here (server only).
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl || !serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY is not set, cron cannot read users.' },
        { status: 500 }
      );
    }
    const supabase = createAdminClient(supabaseUrl, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // In cron mode, iterate over ALL users with active profiles
    const { data: profiles } = await (supabase.from('profiles') as any)
      .select('id, email')
      .not('email', 'is', null);

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ success: true, message: 'No active profiles found' });
    }

    const allResults = [];
    for (const profile of profiles) {
      const res = await runDispatch({ id: profile.id, email: profile.email }, supabase);
      const body = await res.json();
      allResults.push(body);
    }

    return NextResponse.json({ success: true, allResults });
  } catch (err: any) {
    console.error('Cron reminder dispatch error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — Interactive / manual trigger from authenticated user session
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    // No email provider is fine: push notifications still go out, and the
    // logs record the email error so it is easy to spot.

    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client unavailable' }, { status: 500 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized request or session' }, { status: 401 });
    }

    return runDispatch({ id: user.id, email: user.email }, supabase as unknown as SupabaseClient<any>);
  } catch (err: any) {
    console.error('Reminder dispatch error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
