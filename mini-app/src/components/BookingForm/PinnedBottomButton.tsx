import { addMinutesToTime, formatDateISO } from '@/lib/helpers';

import { DateChip } from './DateChip';
import { PinnedPanel } from './PinnedPanel';
import { PrimaryButton } from '../PrimaryButton';

import type { TPinnedBottomButtonProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the pinned bottom button UI and related interactions.
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
export function PinnedBottomButton({
  mode,
  selectedDates,
  timeAssignments,
  selectedService,
  activeDateISO,
  handleChipTap,
  handleOnetimeSubmit,
  onetimeButtonDisabled,
  onetimeButtonText,
  readOnly = false,
  readOnlyActionLabel,
}: TPinnedBottomButtonProps): ReactNode {
  return (
    <PinnedPanel>
      {mode === 'multi' && selectedDates.length > 0 && (
        <div className={'-mx-1 flex gap-2 overflow-x-auto px-1 py-1'}>
          {selectedDates.map((date) => {
            /***************************************************************************************************
             * Defines the iso value used by the component layer.
             *
             * Usage context:
             * - Reused by the component layer to keep shared values centralized.
             ***************************************************************************************************/
            const iso = formatDateISO(date);
            /***************************************************************************************************
             * Defines the time value used by the component layer.
             *
             * Usage context:
             * - Reused by the component layer to keep shared values centralized.
             ***************************************************************************************************/
            const time = timeAssignments[iso];
            /***************************************************************************************************
             * Defines the end time value used by the component layer.
             *
             * Usage context:
             * - Reused by the component layer to keep shared values centralized.
             ***************************************************************************************************/
            const endTime =
              time && selectedService
                ? addMinutesToTime(time, selectedService.durationMinutes)
                : undefined;
            return (
              <DateChip
                key={iso}
                date={date}
                time={time}
                endTime={endTime}
                active={activeDateISO === iso}
                onClick={() => handleChipTap(date)}
              />
            );
          })}
        </div>
      )}
      <PrimaryButton onClick={handleOnetimeSubmit} disabled={onetimeButtonDisabled || readOnly}>
        {readOnly ? (readOnlyActionLabel ?? onetimeButtonText) : onetimeButtonText}
      </PrimaryButton>
    </PinnedPanel>
  );
}
