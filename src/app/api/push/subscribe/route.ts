import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAllowedPushEndpoint } from '@/lib/utils/pushEndpoint';

export async function POST(req: NextRequest) {
  try {
    const { endpoint, p256dh, auth } = await req.json();

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Missing push subscription parameters' }, { status: 400 });
    }

    // Only real browser push services, so the cron can't be pointed at any other URL
    if (!isAllowedPushEndpoint(endpoint)) {
      return NextResponse.json({ error: 'This browser\'s push service is not supported.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceKey) {
      // In local-only mode, return success without DB storage
      return NextResponse.json({ success: true, mode: 'local' });
    }

    // Require authenticated Bearer token — remove insecure profile-row fallback
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify token — getUser() performs a network check against Supabase Auth
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userAgent = req.headers.get('user-agent') || 'Browser Web Push';

    // Upsert push subscription — scoped strictly to authenticated user
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );

    if (error) {
      console.error('Error storing push subscription:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
