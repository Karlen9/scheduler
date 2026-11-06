import { Check, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { accent } from '@/lib/rich';

import { CtaButton } from './CtaButton';
import { SectionHeading } from './SectionHeading';

import type { ReactNode } from 'react';

const INCLUDES = ['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7', 'i8'] as const;

export function FreeSection(): ReactNode {
  const t = useTranslations('free');
  const tCta = useTranslations('cta');

  return (
    <section
      id={'free'}
      aria-labelledby={'free-title'}
      className={'container-page py-16 sm:py-20 lg:py-28'}
    >
      <SectionHeading
        id={'free-title'}
        title={t.rich('title', { accent })}
        subtitle={t('subtitle')}
      />
      <div
        data-fade={''}
        className={
          'surface-featured mx-auto grid max-w-5xl gap-10 rounded-3xl p-6 sm:p-10 lg:grid-cols-2 lg:gap-14 lg:p-12'
        }
      >
        <div className={'flex flex-col items-center text-center lg:items-start lg:text-left'}>
          <p
            className={
              'text-primary text-5xl leading-none font-extrabold tracking-tight lg:text-[3.5rem]'
            }
          >
            {t('price')}
          </p>
          <p className={'text-soft mt-4 text-lg font-medium sm:text-xl'}>{t('priceCaption')}</p>
          <CtaButton size={'lg'} className={'mt-8 w-full sm:w-auto lg:mt-auto'}>
            {tCta('hero')}
          </CtaButton>
        </div>
        <div className={'flex flex-col'}>
          <h3 className={'text-xl font-bold'}>{t('includesTitle')}</h3>
          <ul className={'mt-5 grid gap-3'}>
            {INCLUDES.map((key) => (
              <li key={key} className={'flex items-start gap-3 text-[0.9375rem] font-medium'}>
                <span
                  className={
                    'bg-success/15 text-success mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full'
                  }
                >
                  <Check aria-hidden={'true'} className={'size-3.5'} strokeWidth={3} />
                </span>
                {t(`includes.${key}`)}
              </li>
            ))}
          </ul>
          <p
            className={
              'text-soft border-hairline mt-6 flex gap-3 border-t pt-5 text-sm leading-relaxed'
            }
          >
            <Info aria-hidden={'true'} className={'mt-0.5 size-4 shrink-0'} />
            {t('note')}
          </p>
        </div>
      </div>
    </section>
  );
}
