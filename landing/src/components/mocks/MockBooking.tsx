import { CalendarCheck, Ellipsis } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { ReactNode } from 'react';

const DAYS = [
  { key: 'd1', num: 12 },
  { key: 'd2', num: 13 },
  { key: 'd3', num: 14 },
  { key: 'd4', num: 15 },
  { key: 'd5', num: 16 },
] as const;

const DURATIONS = ['dur1', 'dur2', 'dur3'] as const;
const SLOTS = [
  '10:00',
  '11:00',
  '12:00',
  '12:30',
  '13:00',
  '14:30',
  '15:00',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
  '18:00',
];
const SELECTED_DAY = 'd3';
const SELECTED_DURATION = 'dur1';
const SELECTED_SLOT = '13:00';
const TAKEN_SLOTS = ['11:00', '15:00', '17:00'];

function Label({ children }: { children: ReactNode }): ReactNode {
  return <div className={'text-soft text-[4.2cqw] font-semibold'}>{children}</div>;
}

export function MockBooking(): ReactNode {
  const t = useTranslations('mocks.booking');

  return (
    <div className={'flex h-full flex-col'}>
      <div className={'bg-card flex items-center justify-between px-[5cqw] pt-[12cqw] pb-[3cqw]'}>
        <span className={'text-primary text-[4.6cqw]'}>{t('close')}</span>
        <span className={'text-[5cqw] font-bold'}>{t('title')}</span>
        <Ellipsis aria-hidden={'true'} className={'text-primary size-[5.6cqw]'} />
      </div>

      <div className={'flex flex-1 flex-col gap-[3.6cqw] px-[5cqw] pt-[4cqw] pb-[11cqw]'}>
        <div className={'bg-card flex items-center gap-[3.4cqw] rounded-[4cqw] p-[3.4cqw]'}>
          <span
            className={
              'from-primary to-brand text-primary-foreground flex size-[13cqw] shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[5.8cqw] font-bold'
            }
          >
            {t('specialist').charAt(0)}
          </span>
          <div className={'leading-tight'}>
            <div className={'text-[5.4cqw] font-bold'}>{t('specialist')}</div>
            <div className={'text-soft mt-[0.6cqw] text-[4.2cqw]'}>{t('role')}</div>
          </div>
          <span
            className={
              'bg-primary/12 text-primary ml-auto rounded-full px-[3cqw] py-[1.2cqw] text-[4cqw] font-semibold'
            }
          >
            {t('duration')}
          </span>
        </div>

        <div className={'flex flex-col gap-[1.8cqw]'}>
          <div className={'flex items-baseline justify-between'}>
            <Label>{t('dateLabel')}</Label>
            <span className={'text-[4.2cqw] font-semibold'}>{t('month')}</span>
          </div>
          <div className={'grid grid-cols-5 gap-[2cqw]'}>
            {DAYS.map((day) => {
              const selected = day.key === SELECTED_DAY;
              return (
                <div
                  key={day.key}
                  className={`flex flex-col items-center rounded-[3cqw] py-[2.6cqw] leading-tight ${
                    selected ? 'bg-primary text-primary-foreground' : 'bg-card'
                  }`}
                >
                  <span className={`text-[3.8cqw] ${selected ? '' : 'text-soft'}`}>
                    {t(`days.${day.key}`)}
                  </span>
                  <span className={'text-[5.8cqw] font-bold'}>{day.num}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className={'flex flex-col gap-[1.8cqw]'}>
          <Label>{t('durationLabel')}</Label>
          <div className={'grid grid-cols-3 gap-[2cqw]'}>
            {DURATIONS.map((key) => {
              const selected = key === SELECTED_DURATION;
              return (
                <div
                  key={key}
                  className={`rounded-[3cqw] py-[2.6cqw] text-center text-[4.6cqw] font-semibold ${
                    selected ? 'bg-primary text-primary-foreground' : 'bg-card'
                  }`}
                >
                  {t(key)}
                </div>
              );
            })}
          </div>
        </div>

        <div className={'flex min-h-0 flex-1 flex-col gap-[1.8cqw]'}>
          <Label>{t('timeLabel')}</Label>
          <div className={'grid flex-1 grid-cols-3 grid-rows-4 gap-[2cqw]'}>
            {SLOTS.map((slot) => {
              const selected = slot === SELECTED_SLOT;
              const taken = TAKEN_SLOTS.includes(slot);
              return (
                <div
                  key={slot}
                  className={`flex items-center justify-center rounded-[3cqw] text-[4.8cqw] font-semibold ${
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : taken
                        ? 'bg-card text-soft line-through opacity-50'
                        : 'bg-card'
                  }`}
                >
                  {slot}
                </div>
              );
            })}
          </div>
        </div>

        <div
          className={
            'bg-card flex items-center gap-[2.6cqw] rounded-[3.4cqw] px-[3.6cqw] py-[3cqw]'
          }
        >
          <CalendarCheck aria-hidden={'true'} className={'text-primary size-[5.6cqw] shrink-0'} />
          <span className={'text-[4.6cqw] font-semibold'}>{t('summary')}</span>
        </div>

        <div
          className={
            'bg-primary text-primary-foreground rounded-[4cqw] py-[4cqw] text-center text-[5cqw] font-bold'
          }
        >
          {t('confirm')}
        </div>
      </div>
    </div>
  );
}
