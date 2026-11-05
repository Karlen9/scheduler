import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { FAQ_GROUPS } from '@/lib/faq';

import en from '../../messages/en.json';
import ru from '../../messages/ru.json';

type TTree = { [key: string]: string | TTree };

function keys(tree: TTree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : keys(value, `${prefix}${key}.`),
  );
}

type TFaqItem = { q: string; a: string };

const MINI_APP_FAQ_IDS = [1, 2, 9, 11, 3, 4, 6, 5, 7, 8, 10, 12];

function miniApp(locale: 'ru' | 'en'): Record<string, string> {
  const file = path.resolve(__dirname, `../../../mini-app/messages/${locale}.json`);
  return JSON.parse(readFileSync(file, 'utf8')).AdminHelp;
}

describe('messages', () => {
  it('have identical key sets in ru and en', () => {
    expect(keys(en as TTree).sort()).toEqual(keys(ru as TTree).sort());
  });

  it.each([
    ['ru', ru],
    ['en', en],
  ])('%s has 18 FAQ items and no empty strings', (_, messages) => {
    const items = messages.faq.items as Record<string, TFaqItem>;
    expect(Object.keys(items)).toHaveLength(18);
    expect(FAQ_GROUPS.flatMap((group) => [...group.items])).toEqual(
      Array.from({ length: 18 }, (_, i) => i + 1),
    );
    for (const key of keys(messages as TTree)) {
      const value = key.split('.').reduce<unknown>((node, part) => (node as TTree)[part], messages);
      expect(value, key).not.toBe('');
    }
  });

  it.each([
    ['ru', ru],
    ['en', en],
  ] as const)('%s FAQ items 7-18 match the mini-app AdminHelp text', (locale, messages) => {
    const source = miniApp(locale);
    const items = messages.faq.items as Record<string, TFaqItem>;

    MINI_APP_FAQ_IDS.forEach((sourceId, index) => {
      const item = items[`i${index + 7}`];
      let answer = source[`faq_a${sourceId}`];
      if (sourceId === 4) {
        answer = answer
          .replace(' с небольшой задержкой после ввода', '')
          .replace(' after a short debounce', '');
      }
      if (sourceId === 7) {
        answer = answer
          .replace(' Кнопки пагинации переключают страницы.', '')
          .replace(' Pagination buttons move between pages.', '');
      }
      expect(item.q).toBe(source[`faq_q${sourceId}`]);
      expect(item.a).toBe(answer);
    });
  });

  it('never claims superlatives', () => {
    const text = JSON.stringify([ru, en]).toLowerCase();
    expect(text).not.toMatch(/лучш|best\b(?! value)/);
  });
});
