import { routing } from '@/i18n/routing';

import type { TLocale } from '@/i18n/routing';

// The single place to rename the product, per locale.
export const PRODUCT_NAMES: Record<TLocale, string> = {
  ru: 'Специалист',
  en: 'Scheduler',
};

export function getProductName(locale: string): string {
  return (PRODUCT_NAMES as Record<string, string>)[locale] ?? PRODUCT_NAMES[routing.defaultLocale];
}

export const MASTER_BOT_USERNAME = 'schedu1erbot';
export const MASTER_BOT_URL = `https://t.me/${MASTER_BOT_USERNAME}`;

export function resolveSiteUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) {
    return `https://${vercel}`;
  }
  return 'http://localhost:3000';
}

export function resolveContactEmail(raw: string | undefined): string | null {
  const value = raw?.trim();
  return value ? value : null;
}

export const SITE_URL = resolveSiteUrl();
export const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://sport-app-orcin.vercel.app'
).replace(/\/+$/, '');
export const CONTACT_EMAIL = resolveContactEmail(process.env.NEXT_PUBLIC_CONTACT_EMAIL);
export const PRIVACY_URL = `${APP_URL}/privacy`;
export const TERMS_URL = `${APP_URL}/terms`;
