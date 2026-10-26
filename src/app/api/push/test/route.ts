import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWebPushToUser } from '@/lib/services/serverPushService';

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 });
    }

    // Require authenticated Bearer token — no anonymous or profile-fallback access
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify token against Supabase Auth — getUser() is the authoritative check
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Confirm profile exists for this authenticated user only
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: 'No user profile found' }, { status: 404 });
    }

    // Send only to the device that tapped the button when it tells us which one
    const body = await req.json().catch(() => ({}));
    const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : undefined;

    const result = await sendWebPushToUser(
      user.id,
      {
        title: 'Test reminder from Sweep',
        body: 'Reminders work on this device. Tap to open Sweep.',
        url: '/home',
        tag: 'sweep-test-push',
      },
      { endpoint }
    );

    if (result.sent === 0) {
      return NextResponse.json({
        success: false,
        error: 'This device is not set up for reminders yet. Tap Turn on reminders first.',
      });
    }

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
