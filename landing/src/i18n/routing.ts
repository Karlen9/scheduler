import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['ru', 'en'],
  defaultLocale: 'ru',
  localePrefix: 'as-needed',
  localeDetection: false,
  localeCookie: false,
});

export type TLocale = (typeof routing.locales)[number];
