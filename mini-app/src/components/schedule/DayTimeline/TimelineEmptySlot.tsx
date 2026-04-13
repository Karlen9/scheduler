import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { TTimelineEmptySlotProps } from '@/lib/types';
import type { ReactNode } from 'react';

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
  onToggleCollapse,
  onEmptySlotClick,
}: TTimelineEmptySlotProps): ReactNode {
  const t = useTranslations('DayTimeline');

  if (collapsed) {
    return (
      <div
        className={
          'bg-card border-surface-border absolute right-0 left-12 flex items-center justify-between overflow-hidden rounded-xl border border-dashed px-3'
        }
        style={{ top: top + 3, height: height - 3 }}
      >
        <span className={'text-muted-foreground/60 text-xs'}>
          {formatMinutes(slot.startMin)}
          {' – '}
          {formatMinutes(slot.endMin)}
        </span>
        <button
          onClick={onToggleCollapse}
          className={'text-muted-foreground hover:text-foreground p-1'}
        >
          <ChevronDown className={'h-4 w-4'} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => onEmptySlotClick?.(date, formatMinutes(slot.startMin))}
      className={
        'bg-card border-surface-border absolute right-0 left-12 overflow-hidden rounded-xl border border-dashed px-3 py-2 text-left transition-opacity active:opacity-80'
      }
      style={{ top: top + 3, height: height - 3 }}
    >
      <div className={'flex h-full items-center justify-between'}>
        <div className={'min-w-0'}>
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
        <div className={'flex shrink-0 items-center gap-1'}>
          {onToggleCollapse && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse();
              }}
              className={'text-muted-foreground hover:text-foreground p-1'}
            >
              <ChevronUp className={'h-4 w-4'} />
            </button>
          )}
          <div className={'bg-brand/10 flex h-7 w-7 items-center justify-center rounded-full'}>
            <Plus className={'text-brand h-3.5 w-3.5'} />
          </div>
        </div>
      </div>
    </button>
  );
}
