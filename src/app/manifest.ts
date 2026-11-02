import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/brand';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name, short_name: BRAND.name, description: BRAND.description,
    start_url: '/app', scope: '/', display: 'standalone', orientation: 'portrait',
    background_color: '#f6f3ee', theme_color: '#f6f3ee', categories: ['lifestyle', 'shopping'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Add clothes', url: '/app/add' }, { name: 'AI Stylist', url: '/app/stylist' }, { name: 'Own It', url: '/app/own-it' },
    ],
  };
}
