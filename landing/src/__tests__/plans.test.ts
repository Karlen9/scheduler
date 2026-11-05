import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PLANS, TRIAL_DAYS, derivePlan, formatRub } from '@/lib/plans';

const CONFIG_PATH = path.resolve(__dirname, '../../../bot/internal/config/config.go');
const source = readFileSync(CONFIG_PATH, 'utf8');

describe('plans stay in sync with bot/internal/config/config.go', () => {
  const parsed = Array.from(
    source.matchAll(/\{Code:\s*"(\w+)",\s*PriceKopecks:\s*(\d+),\s*DurationDays:\s*(\d+)\}/g),
  ).map(([, code, price, days]) => ({
    code,
    priceKopecks: Number(price),
    durationDays: Number(days),
  }));

  it('finds the three plan lines', () => {
    expect(parsed).toHaveLength(3);
  });

  it('matches PLANS exactly', () => {
    expect(parsed).toEqual(PLANS.map((plan) => ({ ...plan })));
  });

  it('matches the default trial length', () => {
    const match = source.match(/trialDays\s*:=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBe(TRIAL_DAYS);
  });
});

describe('derived values use the bot integer math', () => {
  const [monthly, quarterly, annual] = PLANS.map((plan) => derivePlan(plan));

  it('computes months', () => {
    expect([monthly.months, quarterly.months, annual.months]).toEqual([1, 3, 12]);
  });

  it('computes prices', () => {
    expect([monthly.priceRub, quarterly.priceRub, annual.priceRub]).toEqual([590, 1490, 4990]);
  });

  it('computes per-month price and savings', () => {
    expect(quarterly.perMonthRub).toBe(496);
    expect(quarterly.savePct).toBe(15);
    expect(annual.perMonthRub).toBe(415);
    expect(annual.savePct).toBe(29);
    expect(monthly.savePct).toBe(0);
  });

  it('formats rubles with a ruble sign in both locales', () => {
    expect(formatRub(1490, 'ru').replace(/\s/g, ' ')).toBe('1 490 ₽');
    expect(formatRub(590, 'en')).toBe('590 ₽');
    expect(formatRub(4990, 'en')).toBe('4,990 ₽');
  });
});
