'use client';

import { useTranslations } from 'next-intl';

import { BottomSheet } from '@/components/BottomSheet';

import type { TTimePickerModalProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Defines the hours value used by the component layer.
 *
 * Usage context:
 * - Reused by the component layer to keep shared values centralized.
 ***************************************************************************************************/
const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

/***************************************************************************************************
 * Renders the time picker modal UI and related interactions.
 *
 * Parameters:
 * - props: Component props that drive rendering and callbacks.
 *
 * Returns:
 * - The computed value for the current operation as ReactNode.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
export function TimePickerModal({
  isOpen,
  onClose,
  onSelect,
  selectedTime,
  title,
  availableTimes,
}: TTimePickerModalProps): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('TimePickerModal');
  /***************************************************************************************************
   * Defines the resolved title value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const resolvedTitle = title ?? t('title');
  const allowedTimes = availableTimes ? new Set(availableTimes) : null;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={resolvedTitle}
      className={'max-h-[80vh] overflow-auto'}
    >
      <div className={'grid grid-cols-4 gap-2'}>
        {HOURS.map((time) => (
          <button
            key={time}
            onClick={() => {
              if (allowedTimes && !allowedTimes.has(time)) {
                return;
              }
              onSelect(time);
              onClose();
            }}
            disabled={allowedTimes !== null && !allowedTimes.has(time)}
            className={`rounded-lg py-3 text-sm transition-colors ${
              selectedTime === time
                ? 'bg-brand text-white'
                : allowedTimes !== null && !allowedTimes.has(time)
                  ? 'bg-surface-hover text-muted-foreground cursor-not-allowed opacity-50'
                  : 'bg-card text-foreground active:bg-border'
            }`}
          >
            {time}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
