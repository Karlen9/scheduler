import { PLANS, derivePlan, formatNumber } from './plans';

export const FAQ_GROUPS = [
  { id: 'start', items: [1, 2, 3] },
  { id: 'pricing', items: [4, 5, 6] },
  { id: 'services', items: [7, 8, 9] },
  { id: 'clients', items: [10, 11, 12, 13] },
  { id: 'bookings', items: [14, 15, 16, 17, 18] },
] as const;

// Values for the ICU placeholders in FAQ answers; amounts come from plans.ts, never from copy.
export function faqPriceValues(locale: string): Record<string, string> {
  const [monthly, quarterly, annual] = PLANS.map((plan) => derivePlan(plan));
  const n = (value: number): string => formatNumber(value, locale);
  return {
    monthly: n(monthly.priceRub),
    quarterly: n(quarterly.priceRub),
    quarterlyPerMonth: n(quarterly.perMonthRub),
    annual: n(annual.priceRub),
    annualPerMonth: n(annual.perMonthRub),
  };
}
