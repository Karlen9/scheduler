import { ArrowLeftRight, CalendarCheck, CalendarRange, UserRound, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { accent } from '@/lib/rich';

import { PhoneFrame } from './PhoneFrame';
import { SectionHeading } from './SectionHeading';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

const POINTS: { key: string; Icon: LucideIcon }[] = [
  { key: 'dates', Icon: CalendarCheck },
  { key: 'calendar', Icon: Users },
  { key: 'offline', Icon: UserRound },
  { key: 'swap', Icon: ArrowLeftRight },
  { key: 'weeks', Icon: CalendarRange },
];

function Point({ point }: { point: (typeof POINTS)[number] }): ReactNode {
  const t = useTranslations('room.items');
  const { key, Icon } = point;

  return (
    <li
      data-feature={''}
      data-glow={''}
      className={'surface glow-card flex items-start gap-4 rounded-3xl p-5 sm:p-6'}
    >
      <span
        className={
          'bg-primary/12 text-primary flex size-11 shrink-0 items-center justify-center rounded-2xl'
        }
      >
        <Icon aria-hidden={'true'} className={'size-5'} />
      </span>
      <div>
        <h3 className={'text-lg leading-snug font-bold'}>{t(`${key}.title`)}</h3>
        <p className={'text-soft mt-1.5 text-[0.9375rem] leading-relaxed'}>{t(`${key}.text`)}</p>
      </div>
    </li>
  );
}

// The calendar is the hero phone; the room page and the alternating-weeks sheet sit beside it,
// overlapping its edges. All three stand on the bottom edge of a rounded gradient card (like the
// tall card in the features section) and are cut off by it. Below xl the card sits above a
// single column of points; from xl it stretches to the height of the points column.
export function RoomSection(): ReactNode {
  const t = useTranslations('room');

  return (
    <section
      id={'room'}
      aria-labelledby={'room-title'}
      className={'container-page py-16 sm:py-20 lg:py-28'}
    >
      <SectionHeading
        id={'room-title'}
        title={t.rich('title', { accent })}
        subtitle={t('subtitle')}
      />
      <div className={'grid gap-6 sm:gap-8 xl:grid-cols-2 xl:items-stretch xl:gap-14'}>
        <div
          data-fade={''}
          className={
            'tall-card relative mx-auto h-[320px] w-full max-w-[560px] overflow-hidden rounded-3xl shadow-[0_0_0_1px_var(--hairline)] sm:h-[460px] xl:h-auto xl:min-h-[560px] xl:max-w-none'
          }
        >
          <div
            className={'absolute inset-x-0 -bottom-6 flex items-end justify-center [&>*]:shrink-0'}
          >
            <div className={'-mr-5 w-[104px] sm:-mr-7 sm:w-[158px] xl:-mr-8 xl:w-[165px]'}>
              <PhoneFrame screen={'room'} />
            </div>
            <div className={'relative z-10 w-[146px] sm:w-[216px] xl:w-[260px]'}>
              <PhoneFrame screen={'roomCalendar'} />
            </div>
            <div className={'-ml-5 w-[104px] sm:-ml-7 sm:w-[158px] xl:-ml-8 xl:w-[165px]'}>
              <PhoneFrame screen={'roomAlternating'} />
            </div>
          </div>
        </div>

        <ul className={'mx-auto grid w-full max-w-2xl gap-3 xl:max-w-none'}>
          {POINTS.map((point) => (
            <Point key={point.key} point={point} />
          ))}
        </ul>
      </div>
    </section>
  );
}
