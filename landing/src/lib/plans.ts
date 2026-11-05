export type TPlan = {
  code: 'pro_monthly' | 'pro_quarterly' | 'pro_annual';
  priceKopecks: number;
  durationDays: number;
};

// Mirrors bot/internal/config/config.go; plans.test.ts fails on drift.
export const PLANS: readonly TPlan[] = [
  { code: 'pro_monthly', priceKopecks: 59000, durationDays: 30 },
  { code: 'pro_quarterly', priceKopecks: 149000, durationDays: 90 },
  { code: 'pro_annual', priceKopecks: 499000, durationDays: 365 },
];

export const TRIAL_DAYS = 14;

export const HIGHLIGHTED_PLAN: TPlan['code'] = 'pro_annual';

export type TPlanDerived = {
  months: number;
  priceRub: number;
  perMonthKopecks: number;
  perMonthRub: number;
  savePct: number;
};

// Same integer truncation as the bot (master_menu.go), so numbers match what users see there.
export function derivePlan(plan: TPlan, baseKopecks: number = PLANS[0].priceKopecks): TPlanDerived {
  const months = Math.max(1, Math.trunc((plan.durationDays + 15) / 30));
  const perMonthKopecks = Math.trunc(plan.priceKopecks / months);
  return {
    months,
    priceRub: Math.trunc(plan.priceKopecks / 100),
    perMonthKopecks,
    perMonthRub: Math.trunc(perMonthKopecks / 100),
    savePct: Math.trunc(((baseKopecks - perMonthKopecks) * 100) / baseKopecks),
  };
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatRub(rub: number, locale: string): string {
  return `${formatNumber(rub, locale)} ₽`;
}
