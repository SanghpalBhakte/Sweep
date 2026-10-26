import { describe, it, expect } from 'vitest';
import { detectDevice, installCardMode, reminderGuide, type DeviceInfo } from './device';

const UA = {
  androidChrome: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  androidSamsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36',
  androidInstagram: 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 Instagram 350.0.0.0 Android',
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  iphoneFacebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/500.0]',
  ipadAsMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  winChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  winEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
};

describe('detectDevice', () => {
  it('tells platforms and browsers apart', () => {
    expect(detectDevice(UA.androidChrome)).toMatchObject({ platform: 'android', browser: 'chrome', inApp: null });
    expect(detectDevice(UA.androidSamsung)).toMatchObject({ platform: 'android', browser: 'samsung' });
    expect(detectDevice(UA.iphoneSafari)).toMatchObject({ platform: 'ios', browser: 'safari' });
    expect(detectDevice(UA.macSafari)).toMatchObject({ platform: 'mac', browser: 'safari' });
    expect(detectDevice(UA.macChrome)).toMatchObject({ platform: 'mac', browser: 'chrome' });
    expect(detectDevice(UA.winChrome)).toMatchObject({ platform: 'windows', browser: 'chrome' });
    expect(detectDevice(UA.winEdge)).toMatchObject({ platform: 'windows', browser: 'edge' });
  });

  it('spots an iPad that says it is a Mac', () => {
    expect(detectDevice(UA.ipadAsMac, { navPlatform: 'MacIntel', maxTouchPoints: 5 }).platform).toBe('ios');
    expect(detectDevice(UA.ipadAsMac, { navPlatform: 'MacIntel', maxTouchPoints: 0 }).platform).toBe('mac');
  });

  it('spots in-app browsers', () => {
    expect(detectDevice(UA.androidInstagram).inApp).toBe('instagram');
    expect(detectDevice(UA.iphoneFacebook).inApp).toBe('facebook');
  });

  it('keeps the installed flag', () => {
    expect(detectDevice(UA.androidChrome, { standalone: true }).standalone).toBe(true);
  });
});

describe('installCardMode', () => {
  const ready = { canPrompt: true, snoozedUntil: null, now: 1_000, hasSubscriptions: true, modalOpen: false };
  const d = (ua: string, extra: Partial<DeviceInfo> = {}) => ({ ...detectDevice(ua), ...extra });

  it('offers one-tap install only after the browser offered it', () => {
    expect(installCardMode(d(UA.androidChrome), ready)).toBe('prompt');
    expect(installCardMode(d(UA.winEdge), ready)).toBe('prompt');
    expect(installCardMode(d(UA.androidChrome), { ...ready, canPrompt: false })).toBeNull();
  });

  it('shows written steps on iPhone and Mac Safari', () => {
    expect(installCardMode(d(UA.iphoneSafari), { ...ready, canPrompt: false })).toBe('ios');
    expect(installCardMode(d(UA.macSafari), { ...ready, canPrompt: false })).toBe('mac-safari');
  });

  it('asks in-app browsers to open a real browser', () => {
    expect(installCardMode(d(UA.androidInstagram), ready)).toBe('in-app');
    expect(installCardMode(d(UA.iphoneFacebook), ready)).toBe('in-app');
  });

  it('never shows when installed, snoozed, behind a dialog, or before any subscription', () => {
    expect(installCardMode(d(UA.androidChrome, { standalone: true }), ready)).toBeNull();
    expect(installCardMode(d(UA.androidChrome), { ...ready, snoozedUntil: 2_000 })).toBeNull();
    expect(installCardMode(d(UA.androidChrome), { ...ready, modalOpen: true })).toBeNull();
    expect(installCardMode(d(UA.androidChrome), { ...ready, hasSubscriptions: false })).toBeNull();
  });

  it('comes back once the 14-day snooze is over', () => {
    expect(installCardMode(d(UA.androidChrome), { ...ready, snoozedUntil: 500 })).toBe('prompt');
  });
});

describe('reminderGuide', () => {
  const text = (ua: string, extra: Partial<DeviceInfo> = {}) => reminderGuide({ ...detectDevice(ua), ...extra }).steps.join('\n');

  it('Android: notifications, battery, Autostart brands, Do Not Disturb, and install in a tab', () => {
    const g = reminderGuide(detectDevice(UA.androidChrome));
    const t = g.steps.join('\n');
    expect(g.suggestInstall).toBe(true);
    expect(t).toMatch(/App info › Notifications/);
    expect(t).toMatch(/Unrestricted/);
    expect(t).toMatch(/Xiaomi, Redmi, POCO, Oppo, Vivo, Realme or OnePlus.*Autostart/);
    expect(t).toMatch(/Do Not Disturb/);
    expect(text(UA.androidChrome, { standalone: true })).not.toMatch(/^Install/m);
  });

  it('Windows: the right browser background setting, system notifications, Do not disturb', () => {
    expect(text(UA.winChrome)).toMatch(/Chrome › Settings › System › "Continue running background apps/);
    expect(text(UA.winEdge)).toMatch(/Edge › Settings › System and performance/);
    expect(text(UA.winEdge)).toMatch(/Start › Settings › System › Notifications/);
    expect(text(UA.winChrome)).toMatch(/Do not disturb/);
  });

  it('Mac: Add to Dock, Persistent alerts, screen sharing setting', () => {
    const t = text(UA.macSafari);
    expect(t).toMatch(/File › Add to Dock/);
    expect(t).toMatch(/Alert Style Persistent/);
    expect(t).toMatch(/mirroring or sharing the display/);
    expect(text(UA.macSafari, { standalone: true })).not.toMatch(/Add to Dock/);
  });

  it('iPhone: allow, Lock Screen, Persistent banners, Focus; install first in Safari', () => {
    const t = text(UA.iphoneSafari);
    expect(t).toMatch(/Share › Add to Home Screen/);
    expect(t).toMatch(/Settings › Notifications › Sweep/);
    expect(t).toMatch(/Lock Screen/);
    expect(t).toMatch(/Persistent/);
    expect(t).toMatch(/Focus/);
  });
});
