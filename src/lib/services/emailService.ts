// Server only. Sends one email through Gmail (free, works to any address)
// or Resend (needs a verified domain), whichever is set up.
//
// Gmail: set GMAIL_USER (your full gmail address) and GMAIL_APP_PASSWORD
// (a 16 character app password from myaccount.google.com/apppasswords).
// Gmail wins when both are set.
import nodemailer from 'nodemailer';

export type EmailResult = { ok: true; provider: 'gmail' | 'resend' } | { ok: false; error: string };

export function emailProvider(): 'gmail' | 'resend' | null {
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return 'gmail';
  if (process.env.RESEND_API_KEY) return 'resend';
  return null;
}

let gmailTransport: nodemailer.Transporter | null = null;

export async function sendEmail(msg: { to: string; subject: string; html: string }): Promise<EmailResult> {
  const provider = emailProvider();

  if (provider === 'gmail') {
    const viaGmail = await sendViaGmail(msg);
    // If Gmail is set up wrong (bad app password etc), still try Resend when it
    // exists, so reminders keep reaching at least the Resend account owner.
    if (viaGmail.ok || !process.env.RESEND_API_KEY) return viaGmail;
    const viaResend = await sendViaResend(msg);
    return viaResend.ok ? viaResend : { ok: false, error: `${viaGmail.error} | ${viaResend.error}` };
  }

  if (provider === 'resend') return sendViaResend(msg);

  return { ok: false, error: 'No email provider set up (GMAIL_USER + GMAIL_APP_PASSWORD, or RESEND_API_KEY).' };
}

async function sendViaGmail(msg: { to: string; subject: string; html: string }): Promise<EmailResult> {
    try {
      gmailTransport ??= nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: process.env.GMAIL_USER,
          // App passwords are shown with spaces, Gmail accepts them either way
          pass: (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, ''),
        },
      });
      await gmailTransport.sendMail({
        from: `Sweep Reminders <${process.env.GMAIL_USER}>`,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
      });
      return { ok: true, provider: 'gmail' };
    } catch (err) {
      return { ok: false, error: `Gmail error: ${err instanceof Error ? err.message : String(err)}` };
    }
}

async function sendViaResend(msg: { to: string; subject: string; html: string }): Promise<EmailResult> {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'Sweep Reminders <onboarding@resend.dev>',
          to: msg.to,
          subject: msg.subject,
          html: msg.html,
        }),
      });
      if (res.ok) return { ok: true, provider: 'resend' };
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: `Resend error: ${body.message || res.statusText}` };
    } catch (err) {
      return { ok: false, error: `Email network error: ${err instanceof Error ? err.message : String(err)}` };
    }
}

/** Subscription names are typed by users, so escape them before putting them in HTML. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
