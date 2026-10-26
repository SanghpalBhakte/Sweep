// The one public address of the app. Canonical links, Open Graph, sitemap and
// robots all read it from here. Set NEXT_PUBLIC_SITE_URL on Vercel to change it.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://sift-sand.vercel.app').replace(/\/+$/, '');
