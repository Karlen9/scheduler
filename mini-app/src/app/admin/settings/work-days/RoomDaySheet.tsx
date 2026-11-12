'use client';

import { useTranslations } from 'next-intl';

import { BottomSheet } from '@/components/BottomSheet';
import { roomColorVar } from '@/lib/room';

import type { ReactNode } from 'react';

export type TRoomDayOption = {
  /** Member id, or "" for "free". */
  memberId: string;
  label: string;
  /** Palette key; undefined for the "free" option. */
  color?: string;
};

type TRoomDaySheetProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /**
   * `assign`: pick who works that day (me, an offline colleague, or nobody).
   * `linked`: the day belongs to a linked colleague - the only action is to ask for it.
   */
  mode: 'assign' | 'linked';
  options?: TRoomDayOption[];
  onPick?: (memberId: string) => void;
  /** Linked mode: a request for this date is already pending. */
  requested?: boolean;
  requestBusy?: boolean;
  onRequest?: () => void;
  onCancelRequest?: () => void;
};

/***************************************************************************************************
 * Bottom sheet of the room calendar for a day the caller does not simply open or close: choose
 * its owner among the assignable members, or - for a linked colleague's day - ask for it.
 ***************************************************************************************************/
export function RoomDaySheet({
  isOpen,
  onClose,
  title,
  mode,
  options = [],
  onPick,
  requested = false,
  requestBusy = false,
  onRequest,
  onCancelRequest,
}: TRoomDaySheetProps): ReactNode {
  const t = useTranslations('AdminWorkDays');

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      {mode === 'assign' ? (
        <div className={'space-y-2'} data-testid={'room-day-options'}>
          {options.map((option) => (
            <button
              key={option.memberId || 'free'}
              type={'button'}
              data-testid={`room-day-option-${option.memberId || 'free'}`}
              onClick={() => onPick?.(option.memberId)}
              className={
                'bg-background text-foreground flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium active:opacity-70'
              }
            >
              <span
                className={'border-border h-3.5 w-3.5 shrink-0 rounded-full border'}
                style={option.color ? { backgroundColor: roomColorVar(option.color) } : undefined}
              />
              <span className={'min-w-0 flex-1 truncate text-left'}>{option.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className={'space-y-3'}>
          {requested ? (
            <>
              <p className={'text-muted-foreground text-sm'}>{t('requestSent')}</p>
              <button
                type={'button'}
                disabled={requestBusy}
                onClick={onCancelRequest}
                className={
                  'bg-background text-foreground w-full rounded-xl px-4 py-3 text-sm font-medium active:opacity-70 disabled:opacity-40'
                }
              >
                {t('cancelRequest')}
              </button>
            </>
          ) : (
            <>
              <p className={'text-muted-foreground text-sm'}>{t('requestHint')}</p>
              <button
                type={'button'}
                disabled={requestBusy}
                onClick={onRequest}
                className={
                  'bg-brand w-full rounded-xl px-4 py-3 text-sm font-medium text-white active:opacity-80 disabled:opacity-40'
                }
              >
                {t('requestDay')}
              </button>
            </>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
