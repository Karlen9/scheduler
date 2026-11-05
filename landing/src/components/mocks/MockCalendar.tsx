import { CalendarDays, ChartColumn, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { ReactNode } from 'react';

const DAYS = [
  { key: 'd1', num: 12 },
  { key: 'd2', num: 13 },
  { key: 'd3', num: 14 },
  { key: 'd4', num: 15 },
  { key: 'd5', num: 16 },
] as const;

const BLOCKS = [
  { key: 'b1', time: '10:00', n: 2, status: 'confirmed', grow: 1 },
  { key: 'b2', time: '11:30', n: 1, status: 'pending', grow: 1 },
  { key: 'b3', time: '13:00', n: 3, status: 'confirmed', grow: 1.25 },
  { key: 'b4', time: '15:00', n: 4, status: 'completed', grow: 1 },
  { key: 'b5', time: '16:30', n: 2, status: 'confirmed', grow: 1 },
] as const;

const BLOCK_STYLES: Record<(typeof BLOCKS)[number]['n'], string> = {
  1: 'bg-[var(--timeline-1-bg)] border-[var(--timeline-1-border)]',
  2: 'bg-[var(--timeline-2-bg)] border-[var(--timeline-2-border)]',
  3: 'bg-[var(--timeline-3-bg)] border-[var(--timeline-3-border)]',
  4: 'bg-[var(--timeline-4-bg)] border-[var(--timeline-4-border)]',
};

const STATUS_LABEL = {
  confirmed: 'confirmed',
  pending: 'pending',
  completed: 'done',
} as const;

const STATUS_STYLES = {
  confirmed: 'bg-status-confirmed-bg text-status-confirmed-text',
  pending: 'bg-status-pending-bg text-status-pending-text',
  completed: 'bg-status-completed-bg text-status-completed-text',
} as const;

export function MockCalendar(): ReactNode {
  const t = useTranslations('mocks.calendar');
  const tabs = [
    { key: 'tabCalendar', Icon: CalendarDays, active: true },
    { key: 'tabClients', Icon: Users, active: false },
    { key: 'tabStats', Icon: ChartColumn, active: false },
  ] as const;

  return (
    <div className={'flex h-full flex-col'}>
      <div className={'bg-card px-[5cqw] pt-[13cqw] pb-[4cqw]'}>
        <div className={'flex items-end justify-between'}>
          <div>
            <div className={'text-[8.4cqw] leading-none font-extrabold'}>{t('today')}</div>
            <div className={'text-soft mt-[1.8cqw] text-[4.4cqw] font-medium'}>{t('date')}</div>
          </div>
          <span
            className={
              'bg-primary/12 text-primary rounded-full px-[3cqw] py-[1.2cqw] text-[4cqw] font-semibold'
            }
          >
            {t('count')}
          </span>
        </div>
        <div className={'mt-[4cqw] grid grid-cols-5 gap-[2cqw]'}>
          {DAYS.map((day) => {
            const selected = day.key === 'd3';
            return (
              <div
                key={day.key}
                className={`flex flex-col items-center rounded-[3cqw] py-[2.2cqw] leading-tight ${
                  selected ? 'bg-primary text-primary-foreground' : 'bg-background'
                }`}
              >
                <span className={`text-[3.8cqw] ${selected ? '' : 'text-soft'}`}>
                  {t(`days.${day.key}`)}
                </span>
                <span className={'text-[5.6cqw] font-bold'}>{day.num}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={'flex flex-1 flex-col gap-[2.6cqw] px-[5cqw] py-[4cqw]'}>
        {BLOCKS.map((block) => (
          <div
            key={block.key}
            style={{ flexGrow: block.grow }}
            className={'flex min-h-0 gap-[2.8cqw]'}
          >
            <span className={'text-soft w-[11cqw] shrink-0 pt-[1.2cqw] text-[4cqw] font-medium'}>
              {block.time}
            </span>
            <div
              className={`flex flex-1 flex-col justify-between rounded-[3cqw] border-l-[1.4cqw] p-[3cqw] ${BLOCK_STYLES[block.n]}`}
            >
              <div className={'text-[4.8cqw] leading-tight font-bold'}>{t(block.key)}</div>
              <span
                className={`w-fit rounded-full px-[2.6cqw] py-[0.8cqw] text-[3.8cqw] font-semibold ${STATUS_STYLES[block.status]}`}
              >
                {t(STATUS_LABEL[block.status])}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className={'bg-card grid grid-cols-3 px-[3cqw] pt-[3cqw] pb-[9cqw]'}>
        {tabs.map(({ key, Icon, active }) => (
          <div
            key={key}
            className={`flex flex-col items-center gap-[1cqw] ${active ? 'text-primary' : 'text-soft'}`}
          >
            <Icon aria-hidden={'true'} className={'size-[6cqw]'} />
            <span className={'text-[3.6cqw] font-semibold'}>{t(key)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
