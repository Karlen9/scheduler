import { describe, expect, it } from 'vitest';

import { PRODUCT_NAMES, getProductName } from '@/lib/site';

describe('product name', () => {
  it('is Специалист in ru and Scheduler in en', () => {
    expect(getProductName('ru')).toBe('Специалист');
    expect(getProductName('en')).toBe('Scheduler');
    expect(PRODUCT_NAMES).toEqual({ ru: 'Специалист', en: 'Scheduler' });
  });

  it('falls back to the default locale name for unknown locales', () => {
    expect(getProductName('de')).toBe('Специалист');
  });
});
