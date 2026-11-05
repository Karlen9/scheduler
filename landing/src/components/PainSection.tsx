import { BellOff, CalendarX2, MessagesSquare, Moon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { accent } from '@/lib/rich';

import { SectionHeading } from './SectionHeading';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

const ITEMS: { key: string; Icon: LucideIcon }[] = [
  { key: 'lost', Icon: MessagesSquare },
  { key: 'anytime', Icon: Moon },
  { key: 'forget', Icon: BellOff },
  { key: 'late', Icon: CalendarX2 },
];

export function PainSection(): ReactNode {
  const t = useTranslations('pain');

  return (
    <section aria-labelledby={'pain-title'} className={'container-page py-16 sm:py-20 lg:py-28'}>
      <SectionHeading id={'pain-title'} title={t.rich('title', { accent })} />
      <ul className={'grid gap-4 sm:grid-cols-2 lg:grid-cols-4'}>
        {ITEMS.map(({ key, Icon }) => (
          <li key={key} data-pain={''} className={'surface rounded-3xl p-6'}>
            <span
              className={
                'bg-destructive/10 text-destructive mb-5 flex size-11 items-center justify-center rounded-2xl'
              }
            >
              <Icon aria-hidden={'true'} className={'size-5'} />
            </span>
            <h3 className={'text-lg leading-snug font-bold'}>{t(`items.${key}.title`)}</h3>
            <p className={'text-soft mt-2 text-[0.9375rem] leading-relaxed'}>
              {t(`items.${key}.text`)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
