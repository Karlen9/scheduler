import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { TTimelineEmptySlotProps } from '@/lib/types';
import type { KeyboardEvent, ReactNode } from 'react';

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
  onEmptySlotClick,
}: TTimelineEmptySlotProps): ReactNode {
  const t = useTranslations('DayTimeline');
  const isBreak = slot.kind === 'break';
  const canBook = !isBreak && Boolean(onEmptySlotClick);

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

  if (collapsed) {
    return (
      <div
        role={canBook ? 'button' : undefined}
        tabIndex={canBook ? 0 : undefined}
        onClick={canBook ? bookSlot : undefined}
        onKeyDown={handleBookKeyDown}
        className={
          'bg-card border-surface-border absolute right-0 left-12 flex items-center gap-3 overflow-hidden rounded-xl border border-dashed px-3 text-left transition-opacity active:opacity-80'
        }
        style={{ top: top + 3, height: height - 3 }}
      >
        <div className={'min-w-0 flex-1'}>
          <p className={'text-muted-foreground text-sm font-medium'}>
            {isBreak ? t('breakSlot') : t('emptySlot')}
          </p>
          <p className={'text-muted-foreground/60 truncate text-xs'}>
            {formatMinutes(slot.startMin)}
            {' – '}
            {formatMinutes(slot.endMin)}
          </p>
        </div>
        {!isBreak && (
          <div
            className={'bg-brand/10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full'}
          >
            <Plus className={'text-brand h-3.5 w-3.5'} />
          </div>
        )}
      </div>
    );
  }

  if (isBreak) {
    return (
      <div
        className={
          'bg-muted/40 border-surface-border absolute right-0 left-12 overflow-hidden rounded-xl border border-dashed px-3 py-2'
        }
        style={{ top: top + 3, height: height - 3 }}
      >
        <div
          className={'pointer-events-none absolute inset-0'}
          style={{
            backgroundImage:
              'repeating-linear-gradient(-45deg, rgba(239, 68, 68, 0.14) 0 8px, transparent 8px 16px)',
          }}
        />
        <div className={'relative flex h-full items-center justify-between'}>
          <div className={'min-w-0'}>
            <p className={'text-muted-foreground text-sm font-medium'}>{t('breakSlot')}</p>
            {height >= 68 && (
              <p className={'text-muted-foreground/60 text-xs'}>
                {formatMinutes(slot.startMin)}
                {' – '}
                {formatMinutes(slot.endMin)}
              </p>
            )}
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
      className={
        'bg-card border-surface-border absolute right-0 left-12 overflow-hidden rounded-xl border border-dashed px-3 py-2 text-left transition-opacity active:opacity-80'
      }
      style={{ top: top + 3, height: height - 3 }}
    >
      <div className={'flex h-full items-center gap-3'}>
        <div className={'min-w-0 flex-1'}>
          <p className={'text-muted-foreground text-sm font-medium'}>{t('emptySlot')}</p>
          {height >= 54 && (
            <p className={'text-muted-foreground/60 text-xs'}>{t('timeNotOccupied')}</p>
          )}
          {height >= 68 && (
            <p className={'text-muted-foreground/60 text-xs'}>
              {formatMinutes(slot.startMin)}
              {' – '}
              {formatMinutes(slot.endMin)}
            </p>
          )}
        </div>
        <div
          className={'bg-brand/10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full'}
        >
          <Plus className={'text-brand h-3.5 w-3.5'} />
        </div>
      </div>
    </div>
  );
}
