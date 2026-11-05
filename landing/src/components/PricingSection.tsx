import { Check, Info } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { HIGHLIGHTED_PLAN, PLANS, derivePlan, formatNumber, formatRub } from '@/lib/plans';
import { accent } from '@/lib/rich';

import { CtaButton } from './CtaButton';
import { SectionHeading } from './SectionHeading';

import type { TPlan } from '@/lib/plans';
import type { ReactNode } from 'react';

const INCLUDES = ['i1', 'i2', 'i3', 'i4', 'i5'] as const;

const MOBILE_ORDER: Record<TPlan['code'], string> = {
  pro_annual: 'order-1',
  pro_quarterly: 'order-2',
  pro_monthly: 'order-3',
};

function ProCard({ plan }: { plan: TPlan }): ReactNode {
  const t = useTranslations('pricing');
  const locale = useLocale();
  const derived = derivePlan(plan);
  const featured = plan.code === HIGHLIGHTED_PLAN;
  const showSavings = derived.months > 1;

  return (
    <li
      data-price-card={''}
      data-price-featured={featured ? '' : undefined}
      className={`${featured ? 'surface-featured xl:-translate-y-2' : 'surface'} ${MOBILE_ORDER[plan.code]} flex flex-col rounded-3xl p-6 md:order-none`}
    >
      <div className={'flex min-h-8 items-start justify-between gap-3'}>
        <p className={'text-primary text-sm font-bold tracking-wide uppercase'}>{t('pro')}</p>
        {featured ? (
          <span
            className={
              'bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap'
            }
          >
            {t('badge')}
          </span>
        ) : null}
      </div>
      <h3 className={'mt-1 text-xl font-bold'}>{t(`plans.${plan.code}`)}</h3>
      <p className={'mt-4 text-4xl font-extrabold tracking-tight'}>
        {formatRub(derived.priceRub, locale)}
      </p>
      <div className={'mt-3 flex flex-wrap items-center gap-2 md:min-h-7'}>
        {showSavings ? (
          <>
            <span className={'text-soft text-[0.9375rem] font-medium'}>
              {t('perMonth', { price: formatNumber(derived.perMonthRub, locale) })}
            </span>
            <span
              className={
                'bg-status-confirmed-bg text-status-confirmed-text rounded-full px-2.5 py-0.5 text-xs font-bold'
              }
            >
              {t('save', { percent: derived.savePct })}
            </span>
          </>
        ) : null}
      </div>
      <CtaButton variant={featured ? 'primary' : 'secondary'} className={'mt-8 w-full'}>
        {t('cta')}
      </CtaButton>
    </li>
  );
}

export function PricingSection(): ReactNode {
  const t = useTranslations('pricing');

  return (
    <section
      id={'pricing'}
      aria-labelledby={'pricing-title'}
      className={'container-page py-16 sm:py-20 lg:py-28'}
    >
      <SectionHeading
        id={'pricing-title'}
        title={t.rich('title', { accent })}
        subtitle={t('subtitle')}
      />
      <ul className={'grid gap-4 md:grid-cols-2 xl:grid-cols-4 xl:items-stretch'}>
        <li
          data-price-card={''}
          className={'surface order-4 flex flex-col rounded-3xl p-6 md:order-none'}
        >
          <div className={'hidden min-h-8 md:block'} />
          <h3 className={'mt-1 text-xl font-bold'}>{t('free.name')}</h3>
          <p className={'mt-4 text-4xl font-extrabold tracking-tight'}>{t('free.price')}</p>
          <p className={'text-soft mt-3 text-[0.9375rem] leading-snug md:min-h-7'}>
            {t('free.desc')}
          </p>
          <CtaButton variant={'secondary'} className={'mt-8 w-full xl:mt-auto'}>
            {t('free.cta')}
          </CtaButton>
        </li>
        {PLANS.map((plan) => (
          <ProCard key={plan.code} plan={plan} />
        ))}
      </ul>

      <div data-fade={''} className={'surface mt-6 rounded-3xl p-6 sm:p-8'}>
        <h3 className={'text-xl font-bold'}>{t('includesTitle')}</h3>
        <ul className={'mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3'}>
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
    </section>
  );
}
