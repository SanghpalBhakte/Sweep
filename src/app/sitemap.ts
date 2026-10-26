import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', '/login', '/signup', '/privacy'].map((path) => ({
    url: `${SITE_URL}${path === '/' ? '' : path}`,
    changeFrequency: 'weekly',
    priority: path === '/' ? 1 : 0.5,
  }));
}
