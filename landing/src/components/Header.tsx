import { useLocale, useTranslations } from 'next-intl';

import { getPathname } from '@/i18n/navigation';
import { getProductName } from '@/lib/site';

import { CtaButton } from './CtaButton';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Logo } from './Logo';
import { MobileMenu } from './MobileMenu';
import { ThemeToggle } from './ThemeToggle';

import type { ReactNode } from 'react';

const NAV = [
  { key: 'features', href: '#features' },
  { key: 'how', href: '#how' },
  { key: 'pricing', href: '#pricing' },
  { key: 'faq', href: '#faq' },
] as const;

export function Header(): ReactNode {
  const t = useTranslations();
  const locale = useLocale();
  const toDark = t('a11y.toDark');
  const toLight = t('a11y.toLight');

  return (
    <header className={'sticky top-3 z-50 px-3 pt-3 sm:px-4'}>
      <div className={'relative mx-auto max-w-[1180px]'}>
        <div
          className={
            'bg-card/80 flex h-14 items-center gap-2 rounded-full pr-2 pl-3 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.25),0_0_0_1px_var(--hairline)] backdrop-blur-xl sm:pl-4'
          }
        >
          <Logo
            href={getPathname({ locale, href: '/' })}
            label={t('a11y.home', { name: getProductName(locale) })}
          />
          <nav
            aria-label={t('a11y.mainNav')}
            className={'ml-4 hidden items-center gap-0.5 lg:flex'}
          >
            {NAV.map((item) => (
              <a
                key={item.key}
                href={item.href}
                className={
                  'text-soft hover:text-foreground hover:bg-foreground/6 inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-medium transition-colors'
                }
              >
                {t(`nav.${item.key}`)}
              </a>
            ))}
          </nav>
          <div className={'ml-auto flex items-center gap-1'}>
            <LanguageSwitcher className={'hidden lg:inline-flex'} />
            <ThemeToggle toDarkLabel={toDark} toLightLabel={toLight} />
            <div className={'ml-1 hidden lg:block'}>
              <CtaButton size={'sm'}>{t('cta.primary')}</CtaButton>
            </div>
            <MobileMenu openLabel={t('a11y.openMenu')} closeLabel={t('a11y.closeMenu')}>
              <nav aria-label={t('a11y.mainNav')} className={'flex flex-col'}>
                {NAV.map((item) => (
                  <a
                    key={item.key}
                    href={item.href}
                    className={
                      'hover:bg-foreground/6 flex min-h-12 items-center rounded-2xl px-4 text-base font-semibold'
                    }
                  >
                    {t(`nav.${item.key}`)}
                  </a>
                ))}
              </nav>
              <div className={'bg-hairline my-2 h-px'} />
              <div className={'flex flex-col gap-1'}>
                <ThemeToggle
                  withLabel
                  toDarkLabel={toDark}
                  toLightLabel={toLight}
                  className={'rounded-2xl'}
                />
                <LanguageSwitcher className={'mx-4 my-1 inline-flex self-start'} />
              </div>
              <CtaButton className={'mt-3 w-full'}>{t('cta.primary')}</CtaButton>
            </MobileMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
