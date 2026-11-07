import { Check, Send, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { accent } from '@/lib/rich';

import { SectionHeading } from './SectionHeading';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

const POINTS = ['p1', 'p2', 'p3'] as const;

type TColumn = { key: 'manual' | 'telegram'; Icon: LucideIcon; featured: boolean };

const COLUMNS: TColumn[] = [
  { key: 'manual', Icon: UserPlus, featured: true },
  { key: 'telegram', Icon: Send, featured: false },
];

function Column({ column }: { column: TColumn }): ReactNode {
  const t = useTranslations('noTelegram');
  const { key, Icon, featured } = column;

  return (
    <li
      data-fade={''}
      className={`${featured ? 'surface-featured' : 'surface'} flex flex-col rounded-3xl p-6 sm:p-8`}
    >
      <span
        className={
          'bg-primary/12 text-primary mb-5 flex size-11 items-center justify-center rounded-2xl'
        }
      >
        <Icon aria-hidden={'true'} className={'size-5'} />
      </span>
      <h3 className={'text-xl leading-snug font-bold sm:text-2xl'}>{t(`${key}.title`)}</h3>
      <p className={'text-soft mt-2 text-[0.9375rem] leading-relaxed'}>{t(`${key}.text`)}</p>
      <ul className={'mt-5 grid gap-3'}>
        {POINTS.map((point) => (
          <li key={point} className={'flex items-start gap-3 text-[0.9375rem] font-medium'}>
            <span
              className={
                'bg-success/15 text-success mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full'
              }
            >
              <Check aria-hidden={'true'} className={'size-3.5'} strokeWidth={3} />
            </span>
            {t(`${key}.points.${point}`)}
          </li>
        ))}
      </ul>
    </li>
  );
}

export function NoTelegramSection(): ReactNode {
  const t = useTranslations('noTelegram');

  return (
    <section
      id={'no-telegram'}
      aria-labelledby={'no-telegram-title'}
      className={'container-page py-12 sm:py-16 lg:py-20'}
    >
      <SectionHeading
        id={'no-telegram-title'}
        title={t.rich('title', { accent })}
        subtitle={t('subtitle')}
      />
      <ul className={'mx-auto grid max-w-5xl gap-4 md:grid-cols-2'}>
        {COLUMNS.map((column) => (
          <Column key={column.key} column={column} />
        ))}
      </ul>
      <p
        data-fade={''}
        className={'text-soft mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed'}
      >
        {t('note')}
      </p>
    </section>
  );
}
