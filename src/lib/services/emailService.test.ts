import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendMail = vi.fn();
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail }) } }));

const env = { ...process.env };

describe('sendEmail', () => {
  beforeEach(() => {
    vi.resetModules();
    sendMail.mockReset();
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    delete process.env.RESEND_API_KEY;
  });
  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  const msg = { to: 'a@b.com', subject: 's', html: '<p>x</p>' };

  it('says no provider when nothing is set', async () => {
    const { sendEmail } = await import('./emailService');
    const r = await sendEmail(msg);
    expect(r.ok).toBe(false);
  });

  it('uses Gmail when it works', async () => {
    process.env.GMAIL_USER = 'x@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'abcd efgh ijkl mnop';
    sendMail.mockResolvedValue({});
    const { sendEmail } = await import('./emailService');
    expect(await sendEmail(msg)).toEqual({ ok: true, provider: 'gmail' });
  });

  it('falls back to Resend when the Gmail login is rejected', async () => {
    process.env.GMAIL_USER = 'x@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'wrong';
    process.env.RESEND_API_KEY = 're_test';
    sendMail.mockRejectedValue(new Error('535-5.7.8 Username and Password not accepted'));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const { sendEmail } = await import('./emailService');
    expect(await sendEmail(msg)).toEqual({ ok: true, provider: 'resend' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('reports the Gmail error when there is no Resend to fall back to', async () => {
    process.env.GMAIL_USER = 'x@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'wrong';
    sendMail.mockRejectedValue(new Error('535-5.7.8'));
    const { sendEmail } = await import('./emailService');
    const r = await sendEmail(msg);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Gmail error');
  });
});
