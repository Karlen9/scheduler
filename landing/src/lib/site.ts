export const PRODUCT_NAME = 'Scheduler';

export const MASTER_BOT_USERNAME = 'schedu1erbot';
export const MASTER_BOT_URL = `https://t.me/${MASTER_BOT_USERNAME}`;

export const LEGAL_ENTITY = {
  name: 'ИП «Мисакян А.Г.»',
  inn: '615417797158',
  ogrnip: '306615401600040',
} as const;

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
