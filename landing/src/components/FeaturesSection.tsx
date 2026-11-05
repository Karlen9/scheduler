import { BellRing, ChartColumn, CircleCheck, Repeat, ShieldCheck, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { accent } from '@/lib/rich';

import { PhoneFrame } from './PhoneFrame';
import { SectionHeading } from './SectionHeading';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type TFeature = { key: string; Icon: LucideIcon };

const LEFT: TFeature[] = [
  { key: 'confirm', Icon: CircleCheck },
  { key: 'reminders', Icon: BellRing },
  { key: 'recurring', Icon: Repeat },
];

const RIGHT: TFeature[] = [
  { key: 'clients', Icon: Users },
  { key: 'policy', Icon: ShieldCheck },
  { key: 'stats', Icon: ChartColumn },
];

function FeatureCard({ feature }: { feature: TFeature }): ReactNode {
  const t = useTranslations('features.items');
  const { key, Icon } = feature;

  return (
    <li data-feature={''} data-glow={''} className={'surface glow-card rounded-3xl p-6'}>
      <span
        className={
          'bg-primary/12 text-primary mb-5 flex size-11 items-center justify-center rounded-2xl'
        }
      >
        <Icon aria-hidden={'true'} className={'size-5'} />
      </span>
      <h3 className={'text-lg leading-snug font-bold'}>{t(`${key}.title`)}</h3>
      <p className={'text-soft mt-2 text-[0.9375rem] leading-relaxed'}>{t(`${key}.text`)}</p>
    </li>
  );
}

export function FeaturesSection(): ReactNode {
  const t = useTranslations('features');

  return (
    <section
      id={'features'}
      aria-labelledby={'features-title'}
      className={'container-page py-16 sm:py-20 lg:py-28'}
    >
      <SectionHeading
        id={'features-title'}
        title={t.rich('title', { accent })}
        subtitle={t('subtitle')}
      />
      <div
        data-features-grid={''}
        className={'grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1.08fr_1fr]'}
      >
        <ul className={'contents lg:order-1 lg:grid lg:grid-rows-3 lg:gap-4'}>
          {LEFT.map((feature) => (
            <FeatureCard key={feature.key} feature={feature} />
          ))}
        </ul>

        <div
          data-feature={''}
          className={
            'tall-card order-first flex flex-col overflow-hidden rounded-3xl pt-7 shadow-[0_0_0_1px_var(--hairline)] sm:col-span-2 lg:order-2 lg:col-span-1'
          }
        >
          <div className={'px-6 text-center sm:px-10 lg:px-7'}>
            <h3 className={'text-2xl leading-tight font-extrabold sm:text-[1.75rem]'}>
              {t('items.selfbook.title')}
            </h3>
            <p className={'text-soft mx-auto mt-3 max-w-md text-base leading-relaxed'}>
              {t('items.selfbook.text')}
            </p>
          </div>
          <div className={'mt-8 flex flex-1 items-end justify-center overflow-hidden px-6'}>
            <div className={'h-[300px] w-[236px] overflow-hidden sm:h-[340px] sm:w-[256px]'}>
              <PhoneFrame screen={'booking'} className={'w-full'} />
            </div>
          </div>
        </div>

        <ul className={'contents lg:order-3 lg:grid lg:grid-rows-3 lg:gap-4'}>
          {RIGHT.map((feature) => (
            <FeatureCard key={feature.key} feature={feature} />
          ))}
        </ul>
      </div>
    </section>
  );
}
