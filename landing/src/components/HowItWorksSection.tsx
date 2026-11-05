import { useTranslations } from 'next-intl';

import { accent } from '@/lib/rich';

import { SectionHeading } from './SectionHeading';

import type { ReactNode } from 'react';

const STEPS = ['s1', 's2', 's3'] as const;

export function HowItWorksSection(): ReactNode {
  const t = useTranslations('how');

  return (
    <section
      id={'how'}
      aria-labelledby={'how-title'}
      className={'container-page py-16 sm:py-20 lg:py-28'}
    >
      <SectionHeading id={'how-title'} title={t.rich('title', { accent })} />
      <ol className={'relative grid gap-6 md:grid-cols-3 md:gap-5'}>
        <span
          aria-hidden={'true'}
          data-step-line={''}
          className={
            'bg-primary/35 absolute top-6 left-[calc((100%-2.5rem)/6)] hidden h-0.5 w-[calc((100%-2.5rem)*2/3+2.5rem)] origin-left rounded-full md:block'
          }
        />
        {STEPS.map((step, index) => (
          <li key={step} data-step={''} className={'relative flex flex-col items-center'}>
            <span
              className={
                'bg-primary text-primary-foreground relative z-10 mb-4 flex size-12 items-center justify-center rounded-full text-lg font-extrabold shadow-[0_0_0_6px_var(--background)]'
              }
            >
              {index + 1}
            </span>
            <div className={'surface w-full flex-1 rounded-3xl p-6 text-center'}>
              <h3 className={'text-lg font-bold'}>{t(`steps.${step}.title`)}</h3>
              <p className={'text-soft mt-2 text-[0.9375rem] leading-relaxed'}>
                {t(`steps.${step}.text`)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
