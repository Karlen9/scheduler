import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { FaqSection } from '@/components/FaqSection';

import en from '../../messages/en.json';
import ru from '../../messages/ru.json';

const normalize = (text: string): string => text.replace(/\s/g, ' ');

describe.each([
  ['ru', ru, ['590', '1 490', '496', '4 990', '415']],
  ['en', en, ['590', '1,490', '496', '4,990', '415']],
] as const)('FAQ 4 prices (%s)', (locale, messages, expected) => {
  it('renders the real plan prices with no unresolved placeholder', () => {
    const { container } = render(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <FaqSection />
      </NextIntlClientProvider>,
    );
    const items = container.querySelectorAll('details');
    expect(items).toHaveLength(18);
    const text = normalize(items[3].textContent ?? '');

    for (const value of expected) {
      expect(text, value).toContain(`${value} ₽`);
    }
    expect(text).not.toMatch(/[{}]/);
  });
});

describe('FAQ answers with a support hint', () => {
  it('mentions the operator button in FAQ 1', () => {
    expect(ru.faq.items.i1.a).toContain('«💬 Помощь оператора»');
    expect(en.faq.items.i1.a).toContain('"💬 Talk to operator"');
  });
});
