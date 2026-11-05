import { describe, expect, it } from 'vitest';

import { fetchMockAPI } from '../mock-api';

import type { TSubscription } from '../types';

// The mock-api uses a module-level singleton; reset between tests by re-importing.
// Since vitest doesn't reset module state between `it` blocks we rely on sequential
// state mutations being coherent (cancel → resume) or use a fresh describe block per
// stateful flow.

describe('mock-api subscription GET', () => {
  it('returns the default expired subscription with 3 plans', async () => {
    const sub = await fetchMockAPI<TSubscription>('/api/admin/subscription');

    // Default fixture status per createMockState() in mock-api/fixtures.ts (demonstrates
    // the expired/free-tier UI state; changed from 'trialing' in commit 997ded1).
    expect(sub.status).toBe('expired');
    expect(sub.isPro).toBe(false);
    expect(Array.isArray(sub.plans)).toBe(true);
    expect(sub.plans).toHaveLength(3);

    const codes = sub.plans.map((p) => p.code);
    expect(codes).toContain('pro_monthly');
    expect(codes).toContain('pro_quarterly');
    expect(codes).toContain('pro_annual');
  });

  it('has correct prices for each plan', async () => {
    const sub = await fetchMockAPI<TSubscription>('/api/admin/subscription');

    const byCode = Object.fromEntries(sub.plans.map((p) => [p.code, p.priceKopecks]));
    expect(byCode['pro_monthly']).toBe(59000);
    expect(byCode['pro_quarterly']).toBe(149000);
    expect(byCode['pro_annual']).toBe(499000);
  });
});

describe('mock-api subscription checkout', () => {
  it('returns a confirmationUrl for a normal checkout', async () => {
    const result = await fetchMockAPI<{ granted?: boolean; confirmationUrl?: string }>(
      '/api/admin/subscription/checkout',
      {
        method: 'POST',
        body: JSON.stringify({ plan: 'pro_monthly' }),
      },
    );

    expect(result.granted).toBeUndefined();
    expect(typeof result.confirmationUrl).toBe('string');
    expect(result.confirmationUrl).toContain('mock');
  });

  it('grants subscription immediately when MOCK100 promo is applied', async () => {
    const result = await fetchMockAPI<{ granted?: boolean; confirmationUrl?: string }>(
      '/api/admin/subscription/checkout',
      {
        method: 'POST',
        body: JSON.stringify({ plan: 'pro_annual', promoCode: 'MOCK100' }),
      },
    );

    expect(result.granted).toBe(true);
    expect(result.confirmationUrl).toBeUndefined();

    // Subscription state should now be active.
    const sub = await fetchMockAPI<TSubscription>('/api/admin/subscription');
    expect(sub.status).toBe('active');
    expect(sub.isPro).toBe(true);
    expect(sub.plan).toBe('pro_annual');
  });
});

describe('mock-api promocode validate', () => {
  it('validates MOCK100 as a 100% discount on any plan', async () => {
    const result = await fetchMockAPI<{
      valid: boolean;
      discountKopecks?: number;
      finalKopecks?: number;
      discountValue?: number;
    }>('/api/admin/promocode/validate', {
      method: 'POST',
      body: JSON.stringify({ code: 'MOCK100', plan: 'pro_annual' }),
    });

    expect(result.valid).toBe(true);
    expect(result.discountKopecks).toBe(499000);
    expect(result.finalKopecks).toBe(0);
    expect(result.discountValue).toBe(100);
  });

  it('rejects an unknown promo code', async () => {
    const result = await fetchMockAPI<{ valid: boolean; reason?: string }>(
      '/api/admin/promocode/validate',
      {
        method: 'POST',
        body: JSON.stringify({ code: 'INVALID', plan: 'pro_monthly' }),
      },
    );

    expect(result.valid).toBe(false);
    expect(typeof result.reason).toBe('string');
  });
});

describe('mock-api subscription cancel / resume', () => {
  it('sets cancelAtPeriodEnd=true on cancel', async () => {
    const updated = await fetchMockAPI<TSubscription>('/api/admin/subscription/cancel', {
      method: 'POST',
    });

    expect(updated.cancelAtPeriodEnd).toBe(true);
    expect(updated.autoRenew).toBe(false);
  });

  it('sets cancelAtPeriodEnd=false on resume', async () => {
    const updated = await fetchMockAPI<TSubscription>('/api/admin/subscription/resume', {
      method: 'POST',
    });

    expect(updated.cancelAtPeriodEnd).toBe(false);
    expect(updated.autoRenew).toBe(true);
  });
});
