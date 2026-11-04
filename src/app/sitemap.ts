import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/brand';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/privacy', '/terms', '/refunds', '/cookies', '/data-deletion', '/contact', '/signup', '/login']
    .map(p => ({ url: `${BRAND.url}${p}`, changeFrequency: p ? 'yearly' : 'monthly', priority: p ? 0.4 : 1 }));
}
