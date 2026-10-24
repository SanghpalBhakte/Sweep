// =============================================================================
// Sweep - Supabase Edge Function: Automated Reminder Dispatch
// Path: supabase/functions/dispatch-reminders/index.ts
// =============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

interface ProfileRecord {
  id: string;
  email: string;
  full_name?: string;
  notifications_enabled: boolean;
  notify_renewals: boolean;
  notify_trials: boolean;
  currency_preference?: string;
  default_reminder_days?: number[];
}

interface SubscriptionRecord {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  billing_cycle: string;
  custom_interval_days?: number;
  status: string;
  next_renewal_date: string;
  is_trial: boolean;
  trial_end_date?: string | null;
  reminder_offsets?: number[];
  value_rating?: string;
  cancel_url?: string;
  profiles: ProfileRecord;
  categories?: { name: string } | null;
}

// Format relative days label
function getDaysUntil(dateString: string): number {
  const target = new Date(dateString);
  const now = new Date();
  target.setUTCHours(0, 0, 0, 0);
  now.setUTCHours(0, 0, 0, 0);
  const diffTime = target.getTime() - now.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function formatRelativeLabel(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days > 1) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

function formatCurrencyAmount(amount: number, currency: string = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// Generate calm transactional HTML email for renewals
function renderRenewalEmailHtml(params: {
  userName?: string;
  subscriptionName: string;
  amountFormatted: string;
  billingCycle: string;
  renewalDate: string;
  daysUntil: number;
  appUrl: string;
}): string {
  const relativeText = formatRelativeLabel(params.daysUntil);
  const greeting = params.userName ? `Hi ${params.userName},` : 'Hello,';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.subscriptionName} Renewal Reminder</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F6F1E8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #24201E;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F6F1E8; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="520" style="max-width: 520px; background-color: #FCF9F3; border: 1px solid #D8CFC4; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <!-- Header Brand -->
          <tr>
            <td style="padding-bottom: 24px;">
              <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="width: 28px; height: 28px; background-color: #5B294A; border-radius: 6px; text-align: center; color: #FCF9F3; font-weight: bold; font-size: 14px; line-height: 28px;">S</td>
                  <td style="padding-left: 10px; font-size: 14px; font-weight: 700; color: #5B294A; letter-spacing: -0.01em;">SWEEP</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Heading -->
          <tr>
            <td style="font-size: 18px; font-weight: 700; color: #24201E; padding-bottom: 12px; letter-spacing: -0.01em;">
              ${params.subscriptionName} renews ${relativeText}
            </td>
          </tr>

          <!-- Body message -->
          <tr>
            <td style="font-size: 14px; line-height: 1.6; color: #756D65; padding-bottom: 24px;">
              ${greeting}<br><br>
              This is a quiet reminder that your subscription to <strong>${params.subscriptionName}</strong> is scheduled to renew ${relativeText} on <strong>${params.renewalDate}</strong>.
            </td>
          </tr>

          <!-- Summary Card -->
          <tr>
            <td style="background-color: #F6F1E8; border: 1px solid #D8CFC4; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="font-size: 12px; color: #756D65; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Renewal Amount</td>
                  <td align="right" style="font-size: 16px; font-weight: 700; color: #24201E; font-family: monospace;">${params.amountFormatted}</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; color: #756D65; padding-top: 8px;">Billing Cycle</td>
                  <td align="right" style="font-size: 13px; color: #756D65; padding-top: 8px; text-transform: capitalize;">${params.billingCycle}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Action Button -->
          <tr>
            <td style="padding-top: 24px; padding-bottom: 24px;" align="center">
              <a href="${params.appUrl}" style="display: inline-block; background-color: #5B294A; color: #FCF9F3; font-size: 13px; font-weight: 600; text-decoration: none; padding: 10px 20px; border-radius: 6px;">
                Open in Sweep
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top: 1px solid #D8CFC4; padding-top: 16px; font-size: 11px; color: #756D65; line-height: 1.5; text-align: center;">
              You received this reminder because you enabled renewal alerts in your Sweep workspace.<br>
              Manage preferences anytime in <a href="${params.appUrl}/settings" style="color: #5B294A; text-decoration: underline;">Settings</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Generate urgent transactional HTML email for expiring trials
function renderTrialExpiringEmailHtml(params: {
  userName?: string;
  subscriptionName: string;
  conversionAmountFormatted: string;
  trialEndDate: string;
  daysUntil: number;
  cancelUrl?: string;
  appUrl: string;
}): string {
  const relativeText = formatRelativeLabel(params.daysUntil);
  const greeting = params.userName ? `Hi ${params.userName},` : 'Hello,';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Free Trial Ending: ${params.subscriptionName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F6F1E8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #24201E;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F6F1E8; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="520" style="max-width: 520px; background-color: #FCF9F3; border: 1px solid #D8CFC4; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <!-- Header Brand -->
          <tr>
            <td style="padding-bottom: 24px;">
              <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="width: 28px; height: 28px; background-color: #5B294A; border-radius: 6px; text-align: center; color: #FCF9F3; font-weight: bold; font-size: 14px; line-height: 28px;">S</td>
                  <td style="padding-left: 10px; font-size: 14px; font-weight: 700; color: #5B294A; letter-spacing: -0.01em;">SWEEP</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Heading -->
          <tr>
            <td style="font-size: 18px; font-weight: 700; color: #A63F3A; padding-bottom: 12px; letter-spacing: -0.01em;">
              Free trial for ${params.subscriptionName} ends ${relativeText}
            </td>
          </tr>

          <!-- Body message -->
          <tr>
            <td style="font-size: 14px; line-height: 1.6; color: #756D65; padding-bottom: 24px;">
              ${greeting}<br><br>
              Your free trial for <strong>${params.subscriptionName}</strong> expires ${relativeText} on <strong>${params.trialEndDate}</strong>. After this date, it will automatically convert to a paid subscription for <strong>${params.conversionAmountFormatted}</strong>.
            </td>
          </tr>

          <!-- Action Buttons -->
          <tr>
            <td style="padding-bottom: 24px;" align="center">
              <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                  ${
                    params.cancelUrl
                      ? `
                  <td style="padding-right: 12px;">
                    <a href="${params.cancelUrl}" target="_blank" style="display: inline-block; background-color: #A63F3A; color: #FCF9F3; font-size: 13px; font-weight: 600; text-decoration: none; padding: 10px 18px; border-radius: 6px;">
                      Cancel Subscription
                    </a>
                  </td>
                  `
                      : ''
                  }
                  <td>
                    <a href="${params.appUrl}" style="display: inline-block; background-color: #F6F1E8; border: 1px solid #D8CFC4; color: #24201E; font-size: 13px; font-weight: 600; text-decoration: none; padding: 10px 18px; border-radius: 6px;">
                      View in Sweep
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top: 1px solid #D8CFC4; padding-top: 16px; font-size: 11px; color: #756D65; line-height: 1.5; text-align: center;">
              Sent quietly by Sweep to prevent unwanted trial conversions.<br>
              Manage notification preferences in <a href="${params.appUrl}/settings" style="color: #5B294A; text-decoration: underline;">Settings</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

serve(async (req: Request) => {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendFromEmail =
      Deno.env.get('RESEND_FROM_EMAIL') || 'Sweep Reminders <onboarding@resend.dev>';
    const appUrl = Deno.env.get('APP_URL') || 'https://sweep-subs.vercel.app';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch active subscriptions with their owner profile
    const { data: subscriptions, error: subsError } = await supabase
      .from('subscriptions')
      .select('*, profiles:user_id(*), categories(name)')
      .eq('status', 'active');

    if (subsError) {
      console.error('Error fetching subscriptions:', subsError);
      return new Response(JSON.stringify({ error: subsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = {
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      logs: [] as any[],
    };

    const subsList = (subscriptions || []) as unknown as SubscriptionRecord[];

    for (const sub of subsList) {
      const profile = sub.profiles;
      if (!profile || !profile.email) {
        results.skipped++;
        continue;
      }

      // Check user preference
      if (profile.notifications_enabled === false) {
        results.skipped++;
        continue;
      }

      const userOffsets = sub.reminder_offsets && sub.reminder_offsets.length > 0
        ? sub.reminder_offsets
        : profile.default_reminder_days || [7, 3, 1];

      // -----------------------------------------------------------------------
      // 1. Process Upcoming Renewal Alerts
      // -----------------------------------------------------------------------
      if (profile.notify_renewals !== false && sub.next_renewal_date) {
        const daysUntilRenewal = getDaysUntil(sub.next_renewal_date);

        if (userOffsets.includes(daysUntilRenewal) && daysUntilRenewal >= 0) {
          results.processed++;

          // Deduplication check: Has this renewal reminder already been sent?
          const { data: existingLog } = await supabase
            .from('reminder_dispatch_logs')
            .select('id')
            .eq('subscription_id', sub.id)
            .eq('reminder_type', 'renewal')
            .eq('target_date', sub.next_renewal_date)
            .eq('offset_days', daysUntilRenewal)
            .eq('status', 'sent')
            .maybeSingle();

          if (!existingLog) {
            const amountFormatted = formatCurrencyAmount(
              sub.amount,
              sub.currency || profile.currency_preference || 'USD'
            );
            const relativeText = formatRelativeLabel(daysUntilRenewal);
            const subject = `Reminder: ${sub.name} renews ${relativeText} (${amountFormatted})`;

            const htmlBody = renderRenewalEmailHtml({
              userName: profile.full_name,
              subscriptionName: sub.name,
              amountFormatted,
              billingCycle: sub.billing_cycle,
              renewalDate: sub.next_renewal_date,
              daysUntil: daysUntilRenewal,
              appUrl,
            });

            if (resendApiKey) {
              try {
                const resendRes = await fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${resendApiKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    from: resendFromEmail,
                    to: [profile.email],
                    subject,
                    html: htmlBody,
                  }),
                });

                const resendData = await resendRes.json();

                if (resendRes.ok && resendData.id) {
                  await supabase.from('reminder_dispatch_logs').insert({
                    user_id: profile.id,
                    subscription_id: sub.id,
                    reminder_type: 'renewal',
                    target_date: sub.next_renewal_date,
                    offset_days: daysUntilRenewal,
                    delivery_channel: 'email',
                    recipient_email: profile.email,
                    status: 'sent',
                    external_id: resendData.id,
                  });
                  results.sent++;
                  results.logs.push({
                    type: 'renewal',
                    sub: sub.name,
                    to: profile.email,
                    status: 'sent',
                    id: resendData.id,
                  });
                } else {
                  console.error('Resend API error:', resendData);
                  await supabase.from('reminder_dispatch_logs').insert({
                    user_id: profile.id,
                    subscription_id: sub.id,
                    reminder_type: 'renewal',
                    target_date: sub.next_renewal_date,
                    offset_days: daysUntilRenewal,
                    delivery_channel: 'email',
                    recipient_email: profile.email,
                    status: 'failed',
                    error_message: JSON.stringify(resendData),
                  });
                  results.failed++;
                }
              } catch (err: any) {
                console.error('Dispatch error:', err);
                await supabase.from('reminder_dispatch_logs').insert({
                  user_id: profile.id,
                  subscription_id: sub.id,
                  reminder_type: 'renewal',
                  target_date: sub.next_renewal_date,
                  offset_days: daysUntilRenewal,
                  delivery_channel: 'email',
                  recipient_email: profile.email,
                  status: 'failed',
                  error_message: err.message,
                });
                results.failed++;
              }
            } else {
              // Dry-run mode if RESEND_API_KEY is not configured
              console.log(`[DRY RUN] Would send renewal email to ${profile.email} for ${sub.name}`);
              results.sent++;
              results.logs.push({
                type: 'renewal',
                sub: sub.name,
                to: profile.email,
                status: 'dry_run_success',
              });
            }
          } else {
            results.skipped++;
          }
        }
      }

      // -----------------------------------------------------------------------
      // 2. Process Free Trial Expiration Alerts
      // -----------------------------------------------------------------------
      if (profile.notify_trials !== false && sub.is_trial && sub.trial_end_date) {
        const daysUntilTrial = getDaysUntil(sub.trial_end_date);

        if ([7, 3, 1, 0].includes(daysUntilTrial) && daysUntilTrial >= 0) {
          results.processed++;

          // Deduplication check
          const { data: existingTrialLog } = await supabase
            .from('reminder_dispatch_logs')
            .select('id')
            .eq('subscription_id', sub.id)
            .eq('reminder_type', 'trial_expiry')
            .eq('target_date', sub.trial_end_date)
            .eq('offset_days', daysUntilTrial)
            .eq('status', 'sent')
            .maybeSingle();

          if (!existingTrialLog) {
            const conversionFormatted = formatCurrencyAmount(
              sub.amount,
              sub.currency || profile.currency_preference || 'USD'
            );
            const relativeText = formatRelativeLabel(daysUntilTrial);
            const subject = `Action needed: ${sub.name} free trial ends ${relativeText}`;

            const htmlBody = renderTrialEmailHtml({
              userName: profile.full_name,
              subscriptionName: sub.name,
              conversionAmountFormatted: conversionFormatted,
              trialEndDate: sub.trial_end_date,
              daysUntil: daysUntilTrial,
              cancelUrl: sub.cancel_url,
              appUrl,
            });

            if (resendApiKey) {
              try {
                const resendRes = await fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${resendApiKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    from: resendFromEmail,
                    to: [profile.email],
                    subject,
                    html: htmlBody,
                  }),
                });

                const resendData = await resendRes.json();

                if (resendRes.ok && resendData.id) {
                  await supabase.from('reminder_dispatch_logs').insert({
                    user_id: profile.id,
                    subscription_id: sub.id,
                    reminder_type: 'trial_expiry',
                    target_date: sub.trial_end_date,
                    offset_days: daysUntilTrial,
                    delivery_channel: 'email',
                    recipient_email: profile.email,
                    status: 'sent',
                    external_id: resendData.id,
                  });
                  results.sent++;
                  results.logs.push({
                    type: 'trial_expiry',
                    sub: sub.name,
                    to: profile.email,
                    status: 'sent',
                    id: resendData.id,
                  });
                } else {
                  console.error('Resend API error:', resendData);
                  await supabase.from('reminder_dispatch_logs').insert({
                    user_id: profile.id,
                    subscription_id: sub.id,
                    reminder_type: 'trial_expiry',
                    target_date: sub.trial_end_date,
                    offset_days: daysUntilTrial,
                    delivery_channel: 'email',
                    recipient_email: profile.email,
                    status: 'failed',
                    error_message: JSON.stringify(resendData),
                  });
                  results.failed++;
                }
              } catch (err: any) {
                console.error('Dispatch error:', err);
                await supabase.from('reminder_dispatch_logs').insert({
                  user_id: profile.id,
                  subscription_id: sub.id,
                  reminder_type: 'trial_expiry',
                  target_date: sub.trial_end_date,
                  offset_days: daysUntilTrial,
                  delivery_channel: 'email',
                  recipient_email: profile.email,
                  status: 'failed',
                  error_message: err.message,
                });
                results.failed++;
              }
            } else {
              console.log(`[DRY RUN] Would send trial expiry email to ${profile.email} for ${sub.name}`);
              results.sent++;
              results.logs.push({
                type: 'trial_expiry',
                sub: sub.name,
                to: profile.email,
                status: 'dry_run_success',
              });
            }
          } else {
            results.skipped++;
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, summary: results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (globalErr: any) {
    console.error('Global error in dispatch-reminders:', globalErr);
    return new Response(JSON.stringify({ error: globalErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
