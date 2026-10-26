import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// A tiny stand-in for the tables the cron reads and writes.
type Row = Record<string, any>;
let db: Record<string, Row[]>;
let nextId = 1;

function table(name: string) {
  let filter: (r: Row) => boolean = () => true;
  let op: 'select' | 'delete' = 'select';
  let upserted: Row[] | null = null;
  const q: any = {
    select: () => q,
    in: (col: string, vals: unknown[]) => ((filter = ((f) => (r: Row) => f(r) && vals.includes(r[col]))(filter)), q),
    eq: (col: string, val: unknown) => ((filter = ((f) => (r: Row) => f(r) && r[col] === val)(filter)), q),
    delete: () => ((op = 'delete'), q),
    upsert: (row: Row) => {
      const exists = db[name].some((r) => r.subscription_id === row.subscription_id && r.kind === row.kind && r.target_date === row.target_date);
      upserted = exists ? [] : [{ ...row, id: `claim${nextId++}` }];
      db[name].push(...upserted);
      return q;
    },
    then: (resolve: (v: unknown) => void) => {
      if (upserted) return resolve({ data: upserted, error: null });
      if (op === 'delete') {
        db[name] = db[name].filter((r) => !filter(r));
        return resolve({ data: null, error: null });
      }
      resolve({ data: db[name].filter(filter), error: null });
    },
  };
  return q;
}

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: table }) }));

const sendWebPushToUser = vi.fn();
vi.mock('@/lib/services/serverPushService', () => ({ sendWebPushToUser: (...a: unknown[]) => sendWebPushToUser(...a) }));

const sub = {
  id: 's1',
  user_id: 'u1',
  name: 'Netflix',
  amount: 649,
  currency: 'INR',
  billing_cycle: 'monthly',
  custom_interval_days: null,
  next_renewal_date: '2026-10-29',
  is_trial: false,
  trial_end_date: null,
  status: 'active',
  reminder_offsets: [3, 1],
};

function run() {
  return import('./route').then(({ GET }) =>
    GET(new NextRequest('https://sweep.test/api/cron/reminders', { headers: { authorization: 'Bearer s3cret' } }))
  ).then((r) => r.json());
}

describe('/api/cron/reminders', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service');
    db = {
      push_subscriptions: [{ user_id: 'u1' }],
      profiles: [{ id: 'u1', notifications_enabled: true, default_reminder_days: [3, 1], timezone: 'Asia/Kolkata' }],
      subscriptions: [sub],
      reminders_sent: [],
    };
    sendWebPushToUser.mockReset().mockResolvedValue({ sent: 1, failed: 0, cleaned: 0 });
    vi.useFakeTimers({ toFake: ['Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('waits until 9 AM in the person\'s timezone', async () => {
    vi.setSystemTime(new Date('2026-10-26T03:00:00Z')); // 8:30 AM in India
    expect(await run()).toMatchObject({ notYet: 1, sent: 0 });
    expect(sendWebPushToUser).not.toHaveBeenCalled();
  });

  it('sends once with the tagged, deep-linked payload, and never twice', async () => {
    vi.setSystemTime(new Date('2026-10-26T03:40:00Z')); // 9:10 AM in India
    expect(await run()).toMatchObject({ sent: 1 });
    expect(sendWebPushToUser).toHaveBeenCalledWith('u1', {
      title: 'Netflix renews in 3 days',
      body: '₹649 will be charged on 29 Oct.',
      tag: 'renewal_3d_s1_2026-10-29',
      url: '/subscriptions/s1/edit',
    });
    expect(db.reminders_sent).toHaveLength(1);

    // An hour later (pg_cron) and the Vercel backup: already claimed
    vi.setSystemTime(new Date('2026-10-26T04:40:00Z'));
    expect(await run()).toMatchObject({ sent: 0, skipped: 1 });
    expect(sendWebPushToUser).toHaveBeenCalledTimes(1);
  });

  it('gives the reminder back when no device took it, so the next hour retries', async () => {
    vi.setSystemTime(new Date('2026-10-26T03:40:00Z'));
    sendWebPushToUser.mockResolvedValueOnce({ sent: 0, failed: 1, cleaned: 0 });
    expect(await run()).toMatchObject({ failed: 1 });
    expect(db.reminders_sent).toHaveLength(0);

    vi.setSystemTime(new Date('2026-10-26T04:40:00Z'));
    expect(await run()).toMatchObject({ sent: 1 });
    expect(db.reminders_sent).toHaveLength(1);
  });

  it('respects reminders being turned off', async () => {
    vi.setSystemTime(new Date('2026-10-26T03:40:00Z'));
    db.profiles[0].notifications_enabled = false;
    expect(await run()).toMatchObject({ users: 0, sent: 0 });
  });

  it('refuses calls without the cron secret', async () => {
    const { GET } = await import('./route');
    const res = await GET(new NextRequest('https://sweep.test/api/cron/reminders'));
    expect(res.status).toBe(401);
  });
});
