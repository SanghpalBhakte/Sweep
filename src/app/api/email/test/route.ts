import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEmail, emailProvider } from '@/lib/services/emailService';

// Sends one test email to the signed-in user's own address, so they can check
// that reminder emails reach their inbox. Never takes a recipient from the request.

// Gmail allows about 500 emails a day for the whole app. Without a limit, one
// account pressing the button in a loop could use that up and block every
// real reminder. 3 tests per 10 minutes per user is plenty for checking setup.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 3;
const recentTests = new Map<string, number[]>();

function allowTest(userId: string): boolean {
  const now = Date.now();
  const times = (recentTests.get(userId) || []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= MAX_PER_WINDOW) {
    recentTests.set(userId, times);
    return false;
  }
  times.push(now);
  recentTests.set(userId, times);
  return true;
}

export async function POST() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Sign in to send a test email.' }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'Sign in to send a test email.' }, { status: 401 });
  }

  if (!allowTest(user.id)) {
    return NextResponse.json(
      { error: 'You just sent a few test emails. Wait 10 minutes and try again.' },
      { status: 429 }
    );
  }

  if (!emailProvider()) {
    return NextResponse.json({ error: 'Email is not set up on the server yet.' }, { status: 503 });
  }

  const result = await sendEmail({
    to: user.email,
    subject: 'Sweep test email',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; color: #24201E; background: #F6F1E8; border-radius: 12px; border: 1px solid #D8CFC4;">
        <div style="margin-bottom: 16px; font-size: 14px; font-weight: 700; color: #5B294A;">SWEEP</div>
        <p style="font-size: 14px; line-height: 1.6; margin: 0;">Reminder emails are working. You will get one before a subscription renews or a free trial ends.</p>
      </div>`,
  });

  if (!result.ok) {
    console.error('Test email failed:', result.error);
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ success: true, provider: result.provider, to: user.email });
}
