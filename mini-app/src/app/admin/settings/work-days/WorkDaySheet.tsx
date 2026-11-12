'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { IntervalsEditor } from '@/components/IntervalsEditor';
import { PrimaryButton } from '@/components/PrimaryButton';
import { formatIntervalsSummary, getIntervalsErrorKey, sortIntervals } from '@/lib/intervals';

import type { TWorkingInterval } from '@/lib/types';
import type { ReactNode } from 'react';

type TWorkDaySheetProps = {
  isOpen: boolean;
  onClose: () => void;
  /** "Wednesday, 18 November". */
  title: string;
  /** Own hours of the date, or null when it uses the default hours. */
  intervals: TWorkingInterval[] | null;
  defaultIntervals: TWorkingInterval[];
  /** Active bookings on this date (they block closing the day). */
  bookingsCount: number;
  bookingsHref: string;
  /** Sets own hours (array) or restores the default hours (null). */
  onSetHours: (intervals: TWorkingInterval[] | null) => void;
  onCloseDay: () => void;
  /** Label of the close action; room mode calls it "free the day". */
  closeLabel?: string;
  /** Extra actions rendered under the close button (room mode: give the day away). */
  children?: ReactNode;
};

/***************************************************************************************************
 * Bottom sheet for one open date of the work-days calendar: shows its hours and lets the
 * specialist change them, restore the default hours or close the day.
 *
 * Closing is disabled while the date still has active bookings; a link leads to those bookings.
 ***************************************************************************************************/
export function WorkDaySheet({
  isOpen,
  onClose,
  title,
  intervals,
  defaultIntervals,
  bookingsCount,
  bookingsHref,
  onSetHours,
  onCloseDay,
  closeLabel,
  children,
}: TWorkDaySheetProps): ReactNode {
  const t = useTranslations('AdminWorkDays');
  const tc = useTranslations('Common');
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState<TWorkingInterval[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setEditing(false);
    }
  }, [isOpen]);

  const isCustom = intervals !== null && intervals.length > 0;
  const effective = isCustom ? intervals : defaultIntervals;
  const hoursLabel = formatIntervalsSummary(effective);
  const editError = getIntervalsErrorKey(editValue);

  const startEditing = (): void => {
    setEditValue(effective.map((i) => ({ ...i })));
    setEditing(true);
  };

  const applyEdit = (): void => {
    if (editError !== null) {
      return;
    }
    onSetHours(sortIntervals(editValue));
    setEditing(false);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <div className={'space-y-3'}>
        <p className={'text-foreground text-sm'} data-testid={'work-day-hours'}>
          {isCustom
            ? t('hoursCustom', { hours: hoursLabel })
            : t('hoursDefault', { hours: hoursLabel })}
        </p>

        {editing ? (
          <div className={'space-y-3'}>
            <IntervalsEditor intervals={editValue} onChange={setEditValue} />
            <div className={'flex gap-3'}>
              <button
                type={'button'}
                onClick={() => setEditing(false)}
                className={
                  'bg-background text-foreground flex-1 rounded-xl px-4 py-3 text-base font-medium active:opacity-70'
                }
              >
                {tc('cancel')}
              </button>
              <div className={'flex-1'}>
                <PrimaryButton onClick={applyEdit} disabled={editError !== null}>
                  {t('applyHours')}
                </PrimaryButton>
              </div>
            </div>
          </div>
        ) : (
          <div className={'space-y-2'}>
            <button
              type={'button'}
              onClick={startEditing}
              className={
                'bg-background text-foreground w-full rounded-xl px-4 py-3 text-sm font-medium active:opacity-70'
              }
            >
              {t('changeHours')}
            </button>

            {isCustom && (
              <button
                type={'button'}
                onClick={() => onSetHours(null)}
                className={
                  'bg-background text-foreground w-full rounded-xl px-4 py-3 text-sm font-medium active:opacity-70'
                }
              >
                {t('resetHours')}
              </button>
            )}

            <button
              type={'button'}
              onClick={onCloseDay}
              disabled={bookingsCount > 0}
              className={
                'text-destructive bg-destructive/10 w-full rounded-xl px-4 py-3 text-sm font-medium transition-opacity active:opacity-70 disabled:cursor-not-allowed disabled:opacity-40'
              }
            >
              {closeLabel ?? t('closeDay')}
            </button>

            {children}

            {bookingsCount > 0 && (
              <div className={'text-muted-foreground space-y-1 text-center text-xs'}>
                <p>{t('dayHasBookings', { count: bookingsCount })}</p>
                <Link href={bookingsHref} className={'text-brand font-medium'}>
                  {t('goToBookings')}
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
