import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import vm from 'vm';

// Runs the real public/sw.js with a stand-in `self` and checks what it shows.
function loadWorker() {
  const listeners: Record<string, (e: any) => void> = {};
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const self = {
    addEventListener: (type: string, fn: (e: any) => void) => (listeners[type] = fn),
    registration: { showNotification },
    location: { origin: 'https://sweep-subs.vercel.app' },
    clients: { matchAll: vi.fn().mockResolvedValue([]), openWindow: vi.fn(), claim: vi.fn() },
    skipWaiting: vi.fn(),
  };
  vm.runInNewContext(readFileSync(path.join(__dirname, '../../../public/sw.js'), 'utf8'), {
    self,
    caches: {},
    console,
    URL,
    Response,
    fetch,
  });

  async function push(data: unknown) {
    let pending: Promise<unknown> = Promise.resolve();
    const event = {
      data:
        data === undefined
          ? null
          : {
              json: () => (typeof data === 'string' ? JSON.parse(data) : data),
              text: () => (typeof data === 'string' ? data : JSON.stringify(data)),
            },
      waitUntil: (p: Promise<unknown>) => (pending = p),
    };
    listeners.push(event);
    await pending;
    return showNotification.mock.calls.at(-1) as [string, any];
  }
  return { push };
}

describe('service worker push', () => {
  it('shows the flat payload with the app icon, monochrome badge, tag and deep link', async () => {
    const { push } = loadWorker();
    const [title, opts] = await push({
      title: 'Netflix renews in 3 days',
      body: '₹649 will be charged on 29 Oct.',
      tag: 'renewal_3d_s1_2026-10-29',
      url: '/subscriptions/s1/edit',
    });
    expect(title).toBe('Netflix renews in 3 days');
    expect(opts).toMatchObject({
      body: '₹649 will be charged on 29 Oct.',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: 'renewal_3d_s1_2026-10-29',
      renotify: false,
      data: { url: '/subscriptions/s1/edit' },
    });
  });

  it('still shows a notification for an empty or broken push (Safari revokes otherwise)', async () => {
    const { push } = loadWorker();
    const [emptyTitle] = await push(undefined);
    expect(emptyTitle).toBe('Sweep');
    const [title, opts] = await push('not json');
    expect(title).toBe('Sweep');
    expect(opts.body).toBe('not json');
  });

  it('only deep-links inside Sweep', async () => {
    const { push } = loadWorker();
    expect((await push({ title: 't', url: 'https://evil.example' }))[1].data.url).toBe('/home');
    expect((await push({ title: 't', url: '//evil.example' }))[1].data.url).toBe('/home');
  });
});
