import { describe, it, expect } from 'vitest';
import { isAllowedPushEndpoint, pushHost } from './pushEndpoint';

describe('isAllowedPushEndpoint', () => {
  it('accepts the real push services', () => {
    for (const url of [
      'https://fcm.googleapis.com/fcm/send/abc:def',
      'https://web.push.apple.com/QGx1',
      'https://wns2-pn1p.notify.windows.com/w/?token=abc',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
    ]) {
      expect(isAllowedPushEndpoint(url), url).toBe(true);
    }
  });

  it('refuses anything else, so the server is not an open relay', () => {
    for (const url of [
      'http://fcm.googleapis.com/fcm/send/abc', // not https
      'https://fcm.googleapis.com:8443/fcm/send/abc', // odd port
      'https://evil.com/fcm.googleapis.com',
      'https://fcm.googleapis.com.evil.com/x',
      'https://push.apple.com.attacker.net/x',
      'https://user:pass@fcm.googleapis.com/x',
      'https://169.254.169.254/latest/meta-data',
      'not a url',
      42,
      undefined,
    ]) {
      expect(isAllowedPushEndpoint(url), String(url)).toBe(false);
    }
  });
});

describe('pushHost', () => {
  it('keeps only the host, never the token in the path', () => {
    expect(pushHost('https://fcm.googleapis.com/fcm/send/SECRET')).toBe('fcm.googleapis.com');
    expect(pushHost('nope')).toBe('invalid');
  });
});
