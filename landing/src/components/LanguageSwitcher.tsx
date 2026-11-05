import { useLocale, useTranslations } from 'next-intl';

import { getPathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

import type { ReactNode } from 'react';

export function LanguageSwitcher({ className = 'inline-flex' }: { className?: string }): ReactNode {
  const t = useTranslations('a11y');
  const current = useLocale();

  return (
    <div
      role={'group'}
      aria-label={t('language')}
      className={`bg-foreground/6 items-center rounded-full p-1 ${className}`}
    >
      {routing.locales.map((locale) => {
        const active = locale === current;
        return (
          <a
            key={locale}
            href={getPathname({ locale, href: '/' })}
            lang={locale}
            hrefLang={locale}
            aria-current={active ? 'true' : undefined}
            className={`inline-flex min-h-9 min-w-11 items-center justify-center rounded-full px-3 text-[0.8125rem] font-bold tracking-wide uppercase transition-colors ${
              active ? 'bg-card text-foreground shadow-sm' : 'text-soft hover:text-foreground'
            }`}
          >
            {locale}
          </a>
        );
      })}
    </div>
  );
}
