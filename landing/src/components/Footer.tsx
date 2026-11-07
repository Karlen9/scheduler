import { useLocale, useTranslations } from 'next-intl';

import { getPathname } from '@/i18n/navigation';
import { CONTACT_EMAIL, MASTER_BOT_URL, getProductName } from '@/lib/site';

import { Logo } from './Logo';

import type { ReactNode } from 'react';

const NAV = [
  { key: 'features', href: '#features' },
  { key: 'how', href: '#how' },
  { key: 'free', href: '#free' },
  { key: 'faq', href: '#faq' },
] as const;

const LINK =
  'text-soft hover:text-foreground inline-flex min-h-11 items-center text-sm font-medium transition-colors';

export function Footer(): ReactNode {
  const t = useTranslations();
  const locale = useLocale();
  const productName = getProductName(locale);
  const year = new Date().getFullYear();

  return (
    <footer
      className={'border-hairline border-t pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-10'}
    >
      <div className={'container-page pt-12'}>
        <div className={'grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]'}>
          <div>
            <Logo
              href={getPathname({ locale, href: '/' })}
              label={t('a11y.home', { name: productName })}
            />
            {CONTACT_EMAIL ? (
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className={
                  'text-soft hover:text-foreground mt-3 inline-flex min-h-11 items-center text-sm font-medium'
                }
              >
                {CONTACT_EMAIL}
              </a>
            ) : null}
          </div>
          <nav aria-label={t('a11y.mainNav')} className={'flex flex-col'}>
            {NAV.map((item) => (
              <a key={item.key} href={item.href} className={LINK}>
                {t(`nav.${item.key}`)}
              </a>
            ))}
          </nav>
          <div className={'flex flex-col'}>
            <a href={MASTER_BOT_URL} target={'_blank'} rel={'noopener noreferrer'} className={LINK}>
              {t('footer.support')}
            </a>
          </div>
        </div>
        <p
          className={
            'border-hairline text-soft mt-10 border-t pt-6 text-[0.8125rem] leading-relaxed'
          }
        >
          {'© '}
          {year} {productName}
          {'. '}
          {t('footer.rights')}
        </p>
      </div>
    </footer>
  );
}
