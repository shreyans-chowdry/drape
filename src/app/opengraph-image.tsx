import { ImageResponse } from 'next/og';
import { BRAND } from '@/lib/brand';

export const alt = `${BRAND.name} — ${BRAND.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OG() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#f6f3ee', padding: 80, color: '#1c1a17' }}>
        <div style={{ fontSize: 56, fontFamily: 'serif' }}>{BRAND.name}</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 76, lineHeight: 1.05, fontFamily: 'serif', maxWidth: 900 }}>{BRAND.tagline}</div>
          <div style={{ fontSize: 30, color: '#7a7266', marginTop: 24 }}>Catalogue · Style · Plan · Shop smarter</div>
        </div>
        <div style={{ display: 'flex', width: 160, height: 10, background: '#b4532a', borderRadius: 5 }} />
      </div>
    ),
    size,
  );
}
