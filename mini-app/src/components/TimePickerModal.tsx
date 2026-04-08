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
              onSelect(time);
              onClose();
            }}
            className={`rounded-lg py-3 text-sm transition-colors ${
              selectedTime === time
                ? 'bg-brand text-white'
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
