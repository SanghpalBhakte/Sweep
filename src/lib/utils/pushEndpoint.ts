// Push endpoints we accept. Anything else is refused, so a stored "subscription"
// can't make the server POST to an arbitrary URL every day.
const ALLOWED_HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge on Android, Samsung Internet, Opera
  /^([a-z0-9-]+\.)*push\.apple\.com$/, // Safari on iPhone, iPad and Mac
  /^([a-z0-9-]+\.)*notify\.windows\.com$/, // Edge on Windows
  /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/, // Firefox
];

/** Just the host, safe to log (the path holds the device's push token). */
export function pushHost(endpoint: string): string {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return 'invalid';
  }
}

export function isAllowedPushEndpoint(endpoint: unknown): boolean {
  if (typeof endpoint !== 'string' || endpoint.length > 1024) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.port || url.username || url.password) return false;
  return ALLOWED_HOSTS.some((re) => re.test(url.hostname));
}
