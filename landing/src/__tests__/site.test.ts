import { afterEach, describe, expect, it, vi } from 'vitest';

import { MASTER_BOT_URL, resolveContactEmail, resolveSiteUrl } from '@/lib/site';

describe('site config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('points every CTA at the master bot', () => {
    expect(MASTER_BOT_URL).toBe('https://t.me/schedu1erbot');
  });

  it('treats an empty or blank contact email as null', () => {
    expect(resolveContactEmail(undefined)).toBeNull();
    expect(resolveContactEmail('')).toBeNull();
    expect(resolveContactEmail('   ')).toBeNull();
    expect(resolveContactEmail(' hello@example.com ')).toBe('hello@example.com');
  });

  it('yields a null CONTACT_EMAIL when the env var is empty', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONTACT_EMAIL', '');
    vi.resetModules();
    const site = await import('@/lib/site');
    expect(site.CONTACT_EMAIL).toBeNull();
  });

  it('reads CONTACT_EMAIL when set', async () => {
    vi.stubEnv('NEXT_PUBLIC_CONTACT_EMAIL', 'hello@example.com');
    vi.resetModules();
    const site = await import('@/lib/site');
    expect(site.CONTACT_EMAIL).toBe('hello@example.com');
  });

  it('resolves the site url with sensible fallbacks', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'https://a.example/' } as never)).toBe(
      'https://a.example',
    );
    expect(resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'b.example' } as never)).toBe(
      'https://b.example',
    );
    expect(resolveSiteUrl({} as never)).toBe('http://localhost:3000');
  });
});
