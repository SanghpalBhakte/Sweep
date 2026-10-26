import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendNotification = vi.fn();
const deleted: string[] = [];
let rows: Array<{ id: string; endpoint: string; p256dh: string; auth: string }> = [];

vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: (...args: unknown[]) => sendNotification(...args) },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => {
      const q = {
        select: () => q,
        eq: (_col: string, val: string) => {
          if (q.deleting) deleted.push(val);
          return q;
        },
        delete: () => {
          q.deleting = true;
          return q;
        },
        deleting: false,
        then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }),
      };
      return q;
    },
  }),
}));

const payload = { title: 'Netflix renews in 3 days', body: '₹649 will be charged on 29 Oct.', tag: 'renewal_3d_s1_2026-10-29', url: '/subscriptions/s1/edit' };
const FCM = 'https://fcm.googleapis.com/fcm/send/SECRET-TOKEN';
const APPLE = 'https://web.push.apple.com/SECRET-APPLE';

async function load() {
  vi.resetModules();
  return import('./serverPushService');
}

describe('serverPushService', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'pub');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service');
    sendNotification.mockReset();
    deleted.length = 0;
    rows = [];
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('describes a refusal with status, host and reason only', async () => {
    const { describePushRefusal } = await load();
    expect(describePushRefusal({ statusCode: 410, body: '{"reason":"Unregistered"}', endpoint: APPLE })).toEqual({
      status: 410,
      host: 'web.push.apple.com',
      reason: 'Unregistered',
    });
    expect(describePushRefusal({ statusCode: 429, body: 'Too many\n requests', endpoint: FCM }).reason).toBe('Too many requests');
    expect(describePushRefusal({ endpoint: FCM }).status).toBeNull();
  });

  it('sends a flat payload with a TTL and urgency', async () => {
    rows = [{ id: 'row1', endpoint: FCM, p256dh: 'k', auth: 'a' }];
    sendNotification.mockResolvedValue({});
    const { sendWebPushToUser } = await load();
    const res = await sendWebPushToUser('u1', payload);
    expect(res).toEqual({ sent: 1, failed: 0, cleaned: 0 });
    const [, body, opts] = sendNotification.mock.calls[0];
    expect(JSON.parse(body)).toEqual(payload);
    expect(Object.keys(JSON.parse(body))).not.toContain('data');
    expect(opts).toEqual({ TTL: 6 * 60 * 60, urgency: 'normal' });
  });

  it('logs refusals without ids, keys, tokens or text, and deletes only 404/410', async () => {
    rows = [
      { id: 'gone', endpoint: APPLE, p256dh: 'k', auth: 'a' },
      { id: 'busy', endpoint: FCM, p256dh: 'k', auth: 'a' },
      { id: 'forbidden', endpoint: FCM, p256dh: 'k', auth: 'a' },
    ];
    sendNotification
      .mockRejectedValueOnce({ statusCode: 410, body: '{"reason":"Unregistered"}' })
      .mockRejectedValueOnce({ statusCode: 503, body: 'Service Unavailable' })
      .mockRejectedValueOnce({ statusCode: 403, body: 'VAPID credentials do not match' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sendWebPushToUser } = await load();

    const res = await sendWebPushToUser('user-123', payload);

    expect(res).toEqual({ sent: 0, failed: 3, cleaned: 1 });
    expect(deleted).toEqual(['gone']); // 503 is retried next run, 403 kept (the app re-registers it)
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain('web.push.apple.com');
    expect(logged).toContain('Unregistered');
    expect(logged).toContain('503');
    for (const secret of ['SECRET', 'user-123', 'gone', 'busy', 'Netflix', '649']) {
      expect(logged).not.toContain(secret);
    }
  });

  it('never sends to an endpoint outside the allow-list', async () => {
    rows = [{ id: 'bad', endpoint: 'https://evil.example/hook', p256dh: 'k', auth: 'a' }];
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sendWebPushToUser } = await load();
    const res = await sendWebPushToUser('u1', payload);
    expect(sendNotification).not.toHaveBeenCalled();
    expect(res.failed).toBe(1);
  });
});
