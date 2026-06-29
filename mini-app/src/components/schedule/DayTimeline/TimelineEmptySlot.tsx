import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { TTimelineEmptySlotProps } from '@/lib/types';
import type { KeyboardEvent, ReactNode } from 'react';

const AVAILABLE_SLOT_CHROME =
  'border-border/50 bg-black/[0.03] dark:border-brand/30 dark:bg-brand/5';
const BREAK_SLOT_CHROME =
  'border-red-500/20 bg-red-500/[0.08] dark:border-red-400/25 dark:bg-red-500/[0.12]';
const SLOT_TITLE_CLASS = 'text-foreground/70 dark:text-foreground';
const SLOT_META_CLASS = 'text-foreground/40 dark:text-muted-foreground';
const BREAK_STRIPE_BACKGROUND =
  'repeating-linear-gradient(-45deg, rgba(239, 68, 68, 0.16) 0 8px, transparent 8px 16px)';

function formatMinutes(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function TimelineEmptySlot({
  slot,
  date,
  top,
  height,
  collapsed,
  listMode,
  serviceDurations,
  onEmptySlotClick,
}: TTimelineEmptySlotProps): ReactNode {
  const t = useTranslations('DayTimeline');
  const tc = useTranslations('Common');
  const isBreak = slot.kind === 'break';
  const canBook = !isBreak && Boolean(onEmptySlotClick);
  const compact = height < 50;
  const slotDuration = slot.endMin - slot.startMin;
  const timeRange = `${formatMinutes(slot.startMin)} - ${formatMinutes(slot.endMin)}`;
  const fittingDurations = serviceDurations?.filter((duration) => duration <= slotDuration) ?? [];
  const durationHint =
    !isBreak && fittingDurations.length > 0
      ? t('fitsDurations', { durations: `${fittingDurations.join(', ')} ${tc('min')}` })
      : `${slotDuration} ${tc('min')}`;

  function bookSlot(): void {
    if (!isBreak) {
      onEmptySlotClick?.(date, formatMinutes(slot.startMin));
    }
  }

  function handleBookKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (!canBook) {
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      bookSlot();
    }
  }

  if (listMode) {
    if (isBreak) {
      return (
        <div
          className={`relative w-full overflow-hidden rounded-xl border p-4 ${BREAK_SLOT_CHROME}`}
        >
          <div
            className={'pointer-events-none absolute inset-0'}
            style={{ backgroundImage: BREAK_STRIPE_BACKGROUND }}
          />
          <div className={'relative'}>
            <p className={`${SLOT_TITLE_CLASS} text-sm font-medium`}>{t('breakSlot')}</p>
            <p className={`${SLOT_META_CLASS} mt-1 text-xs`}>{timeRange}</p>
          </div>
        </div>
      );
    }

    return (
      <button
        onClick={bookSlot}
        className={`w-full rounded-xl border p-4 text-left transition-opacity active:opacity-80 ${AVAILABLE_SLOT_CHROME}`}
      >
        <div className={'flex items-center justify-between'}>
          <div>
            <p className={`${SLOT_TITLE_CLASS} text-sm font-medium`}>{t('emptySlot')}</p>
            <p className={`${SLOT_META_CLASS} mt-1 text-xs`}>{durationHint}</p>
            <p className={`${SLOT_META_CLASS} mt-1 text-xs`}>{timeRange}</p>
          </div>
          <div
            className={
              'bg-brand/10 dark:bg-brand flex h-8 w-8 shrink-0 items-center justify-center rounded-full'
            }
          >
            <Plus className={'text-brand dark:text-primary-foreground h-4 w-4'} />
          </div>
        </div>
      </button>
    );
  }

  if (collapsed) {
    return (
      <div
        role={canBook ? 'button' : undefined}
        tabIndex={canBook ? 0 : undefined}
        onClick={canBook ? bookSlot : undefined}
        onKeyDown={handleBookKeyDown}
        className={`absolute right-0 left-12 flex items-center gap-3 overflow-hidden rounded-xl border px-3 text-left transition-opacity active:opacity-80 ${isBreak ? BREAK_SLOT_CHROME : AVAILABLE_SLOT_CHROME}`}
        style={{ top: top + 3, height: height - 3 }}
      >
        <div className={'min-w-0 flex-1'}>
          <p className={`${SLOT_TITLE_CLASS} text-sm font-medium`}>
            {isBreak ? t('breakSlot') : t('emptySlot')}
          </p>
          <p className={`${SLOT_META_CLASS} truncate text-xs`}>
            {timeRange}
            {!isBreak && ` · ${durationHint}`}
          </p>
        </div>
        {!isBreak && (
          <div
            className={
              'bg-brand/10 dark:bg-brand flex h-7 w-7 shrink-0 items-center justify-center rounded-full'
            }
          >
            <Plus className={'text-brand dark:text-primary-foreground h-3.5 w-3.5'} />
          </div>
        )}
      </div>
    );
  }

  if (isBreak) {
    return (
      <div
        className={`absolute right-0 left-12 overflow-hidden rounded-xl border px-3 py-2 ${BREAK_SLOT_CHROME}`}
        style={{ top: top + 3, height: height - 3 }}
      >
        <div
          className={'pointer-events-none absolute inset-0'}
          style={{ backgroundImage: BREAK_STRIPE_BACKGROUND }}
        />
        <div className={'relative flex h-full items-center justify-between'}>
          <div className={'min-w-0'}>
            <p className={`${SLOT_TITLE_CLASS} text-sm font-medium`}>{t('breakSlot')}</p>
            {height >= 68 && (
              <p className={`${SLOT_META_CLASS} text-xs`}>
                {timeRange}
                {' · '}
                {durationHint}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div
        role={canBook ? 'button' : undefined}
        tabIndex={canBook ? 0 : undefined}
        onClick={canBook ? bookSlot : undefined}
        onKeyDown={handleBookKeyDown}
        className={`absolute right-0 left-12 overflow-hidden rounded-lg border px-2 py-1 text-left transition-opacity active:opacity-80 ${AVAILABLE_SLOT_CHROME}`}
        style={{ top: top + 3, height: height - 3 }}
      >
        <div className={'flex h-full min-w-0 items-center gap-2'}>
          <span className={`${SLOT_TITLE_CLASS} min-w-0 flex-1 truncate text-xs`}>{timeRange}</span>
          <span className={`${SLOT_META_CLASS} shrink-0 text-[10px] leading-none`}>
            {slotDuration} {tc('min')}
          </span>
          <div
            className={
              'bg-brand/10 dark:bg-brand flex h-5 w-5 shrink-0 items-center justify-center rounded-md'
            }
          >
            <Plus className={'text-brand dark:text-primary-foreground h-3 w-3'} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role={canBook ? 'button' : undefined}
      tabIndex={canBook ? 0 : undefined}
      onClick={canBook ? bookSlot : undefined}
      onKeyDown={handleBookKeyDown}
      className={`absolute right-0 left-12 overflow-hidden rounded-xl border px-3 py-2 text-left transition-opacity active:opacity-80 ${AVAILABLE_SLOT_CHROME}`}
      style={{ top: top + 3, height: height - 3 }}
    >
      <div className={'flex h-full items-center gap-3'}>
        <div className={'min-w-0 flex-1'}>
          <p className={`${SLOT_TITLE_CLASS} text-sm font-medium`}>{t('emptySlot')}</p>
          {height >= 54 && <p className={`${SLOT_META_CLASS} truncate text-xs`}>{durationHint}</p>}
          {height >= 68 && <p className={`${SLOT_META_CLASS} text-xs`}>{timeRange}</p>}
        </div>
        <div
          className={
            'bg-brand/10 dark:bg-brand flex h-7 w-7 shrink-0 items-center justify-center rounded-full'
          }
        >
          <Plus className={'text-brand dark:text-primary-foreground h-3.5 w-3.5'} />
        </div>
      </div>
    </div>
  );
}
