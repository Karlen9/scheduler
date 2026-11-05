import { Gift } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CtaButton } from './CtaButton';

import type { ReactNode } from 'react';

export function ReferralSection(): ReactNode {
  const t = useTranslations('referral');

  return (
    <section aria-labelledby={'referral-title'} className={'container-page py-6 sm:py-10'}>
      <div
        data-fade={''}
        className={
          'surface flex flex-col gap-6 rounded-3xl p-6 sm:p-8 md:flex-row md:items-center md:gap-8'
        }
      >
        <span
          className={
            'bg-primary/12 text-primary flex size-14 shrink-0 items-center justify-center rounded-2xl'
          }
        >
          <Gift aria-hidden={'true'} className={'size-7'} />
        </span>
        <div className={'flex-1'}>
          <h2 id={'referral-title'} className={'text-xl font-bold sm:text-2xl'}>
            {t('title')}
          </h2>
          <p className={'text-soft mt-2 max-w-2xl text-[0.9375rem] leading-relaxed'}>{t('text')}</p>
        </div>
        <CtaButton variant={'secondary'} className={'w-full md:w-auto'}>
          {t('cta')}
        </CtaButton>
      </div>
    </section>
  );
}
