import { Check, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { accent } from '@/lib/rich';
import { getProductName } from '@/lib/site';

import { SectionHeading } from './SectionHeading';

import type { ReactNode } from 'react';

const ROWS = ['r1', 'r2', 'r3', 'r4', 'r5'] as const;

export function ComparisonSection(): ReactNode {
  const t = useTranslations('compare');
  const productName = getProductName(useLocale());

  return (
    <section aria-labelledby={'compare-title'} className={'container-page py-12 sm:py-16 lg:py-20'}>
      <SectionHeading id={'compare-title'} title={t.rich('title', { accent })} />
      <div className={'surface mx-auto max-w-4xl overflow-hidden rounded-3xl'}>
        <div className={'grid gap-2 p-4 sm:p-5 md:grid-cols-2 md:gap-0 md:p-0'}>
          <p
            className={
              'text-soft flex items-center gap-2.5 text-sm font-bold md:px-8 md:py-5 md:text-base'
            }
          >
            <X aria-hidden={'true'} className={'text-destructive size-4 shrink-0'} />
            {t('before')}
          </p>
          <p
            className={
              'md:bg-primary/8 flex items-center gap-2.5 text-sm font-bold md:px-8 md:py-5 md:text-base'
            }
          >
            <Check aria-hidden={'true'} className={'text-primary size-4 shrink-0'} />
            {productName}
          </p>
        </div>
        <ul>
          {ROWS.map((row) => (
            <li
              key={row}
              className={
                'border-hairline grid gap-2 border-t p-4 sm:p-5 md:grid-cols-2 md:gap-0 md:p-0'
              }
            >
              <p className={'text-soft flex items-start gap-3 text-[0.9375rem] md:px-8 md:py-5'}>
                <X aria-hidden={'true'} className={'text-destructive mt-1 size-4 shrink-0'} />
                <span>
                  <span className={'sr-only'}>
                    {t('before')}
                    {': '}
                  </span>
                  {t(`rows.${row}.before`)}
                </span>
              </p>
              <p
                className={
                  'md:bg-primary/8 flex items-start gap-3 text-[0.9375rem] font-semibold md:px-8 md:py-5'
                }
              >
                <Check aria-hidden={'true'} className={'text-success mt-1 size-4 shrink-0'} />
                <span>
                  <span className={'sr-only'}>
                    {productName}
                    {': '}
                  </span>
                  {t(`rows.${row}.after`)}
                </span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
