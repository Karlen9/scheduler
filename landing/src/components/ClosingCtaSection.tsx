import { useTranslations } from 'next-intl';

import { BotQrCode } from './BotQrCode';
import { CtaButton } from './CtaButton';

import type { ReactNode } from 'react';

export function ClosingCtaSection(): ReactNode {
  const t = useTranslations();

  return (
    <section
      id={'closing'}
      aria-labelledby={'closing-title'}
      className={'container-page py-16 sm:py-20 lg:py-28'}
    >
      <div
        data-closing-card={''}
        className={
          'closing-card text-primary-foreground grid grid-cols-[minmax(0,1fr)] items-center gap-10 overflow-hidden rounded-[2rem] p-7 sm:rounded-[2.5rem] sm:p-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16 lg:p-16'
        }
      >
        <div className={'text-center lg:text-left'}>
          <h2
            id={'closing-title'}
            className={'text-[1.875rem] leading-[1.1] font-extrabold sm:text-4xl lg:text-5xl'}
          >
            {t.rich('closing.title', {
              accent: (chunks) => (
                <span className={'font-accent font-medium tracking-normal italic'}>{chunks}</span>
              ),
            })}
          </h2>
          <p className={'mx-auto mt-5 max-w-lg text-base leading-relaxed sm:text-lg lg:mx-0'}>
            {t('closing.text')}
          </p>
          <CtaButton wrap variant={'inverse'} size={'lg'} className={'mt-8 w-full sm:w-auto'}>
            {t('cta.hero')}
          </CtaButton>
        </div>
        <div className={'flex justify-center'}>
          <BotQrCode label={t('closing.qrLabel')} />
        </div>
      </div>
    </section>
  );
}
