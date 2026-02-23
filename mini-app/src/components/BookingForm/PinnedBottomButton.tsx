import { addMinutesToTime, formatDateISO } from '@/lib/helpers';

import { DateChip } from './DateChip';
import { PrimaryButton } from '../PrimaryButton';

import type { TPinnedBottomButtonProps } from '@/lib/types';
import type { ReactNode } from 'react';

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
}: TPinnedBottomButtonProps): ReactNode {
  return (
    <div
      className={'bg-background/80 fixed right-0 bottom-0 left-0 space-y-3 p-4 backdrop-blur-sm'}
      style={{ maxWidth: '430px', margin: '0 auto' }}
    >
      {mode === 'multi' && selectedDates.length > 0 && (
        <div className={'-mx-1 flex gap-2 overflow-x-auto px-1 py-1'}>
          {selectedDates.map((date) => {
            const iso = formatDateISO(date);
            const time = timeAssignments[iso];
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
      <PrimaryButton onClick={handleOnetimeSubmit} disabled={onetimeButtonDisabled}>
        {onetimeButtonText}
      </PrimaryButton>
    </div>
  );
}
