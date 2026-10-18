/**
 * Returns `next` only when it is a path on this site, otherwise `fallback`.
 * Protects the sign-in flow from open redirects (?next=//evil.com).
 *
 * Browsers drop tabs and newlines inside URLs, so "/\t/evil.com" turns into
 * "//evil.com" and leaves the site. Checking the raw string is not enough: the
 * value is parsed the same way the browser will, and must stay on our origin.
 */
const BASE = 'https://sweep.invalid';

export function getSafeNext(next: string | null | undefined, fallback: string = '/'): string {
  if (!next) return fallback;
  const raw = String(next).trim();

  // Control characters and backslashes have no place in our own paths
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;

  try {
    const url = new URL(raw, BASE);
    if (url.origin !== BASE) return fallback;
    const path = `${url.pathname}${url.search}${url.hash}`;
    return path.startsWith('//') ? fallback : path;
  } catch {
    return fallback;
  }
}
