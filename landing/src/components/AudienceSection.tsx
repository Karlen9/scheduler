import { Brain, Dumbbell, Flower2, GraduationCap, Scissors, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { accent } from '@/lib/rich';

import { SectionHeading } from './SectionHeading';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

const ITEMS: { key: string; Icon: LucideIcon }[] = [
  { key: 'trainers', Icon: Dumbbell },
  { key: 'tutors', Icon: GraduationCap },
  { key: 'nails', Icon: Sparkles },
  { key: 'hair', Icon: Scissors },
  { key: 'massage', Icon: Flower2 },
  { key: 'psy', Icon: Brain },
];

export function AudienceSection(): ReactNode {
  const t = useTranslations('audience');

  return (
    <section aria-labelledby={'audience-title'} className={'container-page py-12 sm:py-16'}>
      <SectionHeading id={'audience-title'} title={t.rich('title', { accent })} />
      <ul className={'mx-auto flex max-w-3xl flex-wrap justify-center gap-3'}>
        {ITEMS.map(({ key, Icon }) => (
          <li
            key={key}
            className={
              'surface flex min-h-12 items-center gap-2.5 rounded-full py-2 pr-5 pl-4 text-[0.9375rem] font-semibold sm:text-base'
            }
          >
            <Icon aria-hidden={'true'} className={'text-primary size-[1.15rem] shrink-0'} />
            {t(`items.${key}`)}
          </li>
        ))}
      </ul>
    </section>
  );
}
