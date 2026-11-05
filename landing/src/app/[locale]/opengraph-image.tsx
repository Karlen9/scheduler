import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { ImageResponse } from 'next/og';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { routing } from '@/i18n/routing';
import { LOGO } from '@/lib/logo';
import { MASTER_BOT_URL, getProductName } from '@/lib/site';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// A static export is shared by both locales, so the alt stays free of the product name.
export const alt = MASTER_BOT_URL.replace('https://', '');

export function generateStaticParams(): { locale: string }[] {
  return routing.locales.map((locale) => ({ locale }));
}

// next/og's default font has no Cyrillic, so Inter's latin and cyrillic subsets are loaded by hand.
async function loadFont(subset: 'latin' | 'cyrillic'): Promise<Buffer> {
  return readFile(
    path.join(
      process.cwd(),
      'node_modules/@fontsource/inter/files',
      `inter-${subset}-700-normal.woff`,
    ),
  );
}

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<ImageResponse> {
  const { locale: raw } = await params;
  const locale = hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'hero' });
  const headline = t.raw('title').replace(/<\/?accent>/g, '');
  const [latin, cyrillic] = await Promise.all([loadFont('latin'), loadFont('cyrillic')]);

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        color: '#ffffff',
        fontFamily: 'Inter',
        background: 'linear-gradient(135deg, #2678b6 0%, #5984d8 100%)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <svg width={'72'} height={'72'} viewBox={LOGO.viewBox} fill={'none'} stroke={'#ffffff'}>
          <circle
            cx={LOGO.ring.cx}
            cy={LOGO.ring.cy}
            r={LOGO.ring.r}
            strokeWidth={LOGO.ring.strokeWidth}
          />
          <polyline
            points={LOGO.check.points}
            strokeWidth={LOGO.check.strokeWidth}
            strokeLinecap={'round'}
            strokeLinejoin={'round'}
          />
        </svg>
        <div style={{ fontSize: 40, fontWeight: 700 }}>{getProductName(locale)}</div>
      </div>
      <div
        style={{
          fontSize: 82,
          fontWeight: 700,
          lineHeight: 1.08,
          letterSpacing: -2,
          maxWidth: 1000,
        }}
      >
        {headline}
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, opacity: 0.9 }}>
        {MASTER_BOT_URL.replace('https://', '')}
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Inter', data: latin, weight: 700, style: 'normal' },
        { name: 'Inter', data: cyrillic, weight: 700, style: 'normal' },
      ],
    },
  );
}
