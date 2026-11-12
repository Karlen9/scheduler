'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { TimePickerModal } from '@/components/TimePickerModal';
import {
  MAX_INTERVALS,
  TIME_OPTIONS,
  buildNextInterval,
  getIntervalsErrorKey,
  sortIntervals,
} from '@/lib/intervals';

import type { TWorkingInterval } from '@/lib/types';
import type { ReactNode } from 'react';

type TIntervalsEditorProps = {
  intervals: TWorkingInterval[];
  onChange: (intervals: TWorkingInterval[]) => void;
  /** Rows that cannot be deleted below this count (the last interval stays). */
  minIntervals?: number;
};

/***************************************************************************************************
 * Editor for a list of working-hour intervals of a single day: start/end buttons that open the
 * shared TimePickerModal, a delete button and an "add" button. Used for the default hours and the
 * per-date hours of the dates schedule mode.
 *
 * Parameters:
 * - intervals: Current intervals (controlled).
 * - onChange: Called with the next, sorted list of intervals.
 * - minIntervals: Delete is hidden once this many rows remain. Defaults to 1.
 ***************************************************************************************************/
export function IntervalsEditor({
  intervals,
  onChange,
  minIntervals = 1,
}: TIntervalsEditorProps): ReactNode {
  const t = useTranslations('AdminSchedule');
  const tc = useTranslations('Common');
  const [pickerTarget, setPickerTarget] = useState<{
    index: number;
    type: 'start' | 'end';
  } | null>(null);

  const errorKey = getIntervalsErrorKey(intervals);

  const handleTimeSelect = (time: string): void => {
    if (pickerTarget === null) {
      return;
    }
    onChange(
      sortIntervals(
        intervals.map((interval, index) =>
          index === pickerTarget.index
            ? { ...interval, [pickerTarget.type === 'start' ? 'startTime' : 'endTime']: time }
            : interval,
        ),
      ),
    );
    setPickerTarget(null);
  };

  const pickerInterval = pickerTarget ? intervals[pickerTarget.index] : undefined;

  return (
    <div className={'space-y-3'}>
      <div className={'space-y-2'}>
        {intervals.map((interval, index) => (
          <div
            key={`${index}-${interval.startTime}-${interval.endTime}`}
            className={'flex items-center gap-2'}
          >
            <button
              type={'button'}
              onClick={() => setPickerTarget({ index, type: 'start' })}
              className={
                'bg-background text-foreground min-w-0 flex-1 rounded-lg px-3 py-3 text-sm font-semibold'
              }
            >
              {interval.startTime}
            </button>
            <span className={'text-muted-foreground'}>{'–'}</span>
            <button
              type={'button'}
              onClick={() => setPickerTarget({ index, type: 'end' })}
              className={
                'bg-background text-foreground min-w-0 flex-1 rounded-lg px-3 py-3 text-sm font-semibold'
              }
            >
              {interval.endTime}
            </button>
            {intervals.length > minIntervals && (
              <button
                type={'button'}
                onClick={() => onChange(intervals.filter((_, i) => i !== index))}
                className={
                  'text-muted-foreground hover:text-destructive flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors'
                }
                aria-label={tc('delete')}
              >
                <Trash2 className={'h-4 w-4'} />
              </button>
            )}
          </div>
        ))}
      </div>

      {errorKey && <p className={'text-destructive text-sm'}>{t(errorKey)}</p>}

      {intervals.length < MAX_INTERVALS && (
        <button
          type={'button'}
          onClick={() => onChange(sortIntervals([...intervals, buildNextInterval(intervals)]))}
          className={
            'border-brand/30 text-brand flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-sm font-semibold'
          }
        >
          <Plus className={'h-4 w-4'} />
          {t('addWorkingTime')}
        </button>
      )}

      <TimePickerModal
        isOpen={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        onSelect={handleTimeSelect}
        availableTimes={TIME_OPTIONS}
        selectedTime={
          pickerInterval
            ? pickerTarget?.type === 'start'
              ? pickerInterval.startTime
              : pickerInterval.endTime
            : '10:00'
        }
        title={pickerTarget?.type === 'start' ? t('startTime') : t('endTime')}
      />
    </div>
  );
}
