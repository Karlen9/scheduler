'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import Picker from 'react-mobile-picker';

import { BottomSheet } from '@/components/BottomSheet';

import type { TTimePickerModalProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Defines the hours value used by the component layer.
 *
 * Usage context:
 * - Reused by the component layer to keep shared values centralized.
 ***************************************************************************************************/
const START_MINUTES = 6 * 60;
const END_MINUTES = 24 * 60;
const STEP_MINUTES = 30;
const DEFAULT_TIMES = Array.from(
  { length: (END_MINUTES - START_MINUTES) / STEP_MINUTES + 1 },
  (_, index) => {
    const totalMinutes = START_MINUTES + index * STEP_MINUTES;
    const hours = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
    const minutes = String(totalMinutes % 60).padStart(2, '0');
    return `${hours}:${minutes}`;
  },
);

function timeToMinutes(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':');
  const parsedHours = Number(hours);
  return (parsedHours === 0 ? 24 : parsedHours) * 60 + Number(minutes);
}

function formatMinutes(totalMinutes: number): string {
  const hours = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

type TPickerValue = {
  hour: string;
  minute: string;
};

function parseTime(time: string): TPickerValue {
  const [hour = '06', minute = '00'] = time.split(':');
  return { hour, minute };
}

function joinTime(value: TPickerValue): string {
  return `${value.hour}:${value.minute}`;
}

function getNearestTime(time: string | undefined, times: string[]): string {
  if (time && times.includes(time)) {
    return time;
  }

  if (!time) {
    return times[0] ?? '06:00';
  }

  const targetMinutes = timeToMinutes(time);
  const nearest = times.reduce(
    (bestTime, currentTime) => {
      const bestDiff = Math.abs(timeToMinutes(bestTime) - targetMinutes);
      const currentDiff = Math.abs(timeToMinutes(currentTime) - targetMinutes);
      return currentDiff < bestDiff ? currentTime : bestTime;
    },
    times[0] ?? formatMinutes(START_MINUTES),
  );

  return nearest;
}

function getOrderedHours(times: string[]): string[] {
  return times.reduce<string[]>((acc, time) => {
    const { hour } = parseTime(time);
    return acc.includes(hour) ? acc : [...acc, hour];
  }, []);
}

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
  const times = useMemo(() => availableTimes ?? DEFAULT_TIMES, [availableTimes]);
  const optionsByHour = useMemo(() => {
    return times.reduce<Record<string, string[]>>((acc, time) => {
      const { hour, minute } = parseTime(time);
      acc[hour] = acc[hour] ? [...acc[hour], minute] : [minute];
      return acc;
    }, {});
  }, [times]);
  const hours = useMemo(() => getOrderedHours(times), [times]);
  const [pickerValue, setPickerValue] = useState<TPickerValue>(() =>
    parseTime(getNearestTime(selectedTime, times)),
  );
  const minuteOptions = optionsByHour[pickerValue.hour] ?? [];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setPickerValue(parseTime(getNearestTime(selectedTime, times)));
  }, [isOpen, selectedTime, times]);

  const handlePickerChange = (value: TPickerValue, key: string): void => {
    if (key === 'hour') {
      const minutesForHour = optionsByHour[value.hour] ?? [];
      const minute = minutesForHour.includes(value.minute) ? value.minute : minutesForHour[0];
      if (minute) {
        setPickerValue({ hour: value.hour, minute });
      }
      return;
    }

    setPickerValue(value);
  };

  const handleConfirm = (): void => {
    onSelect(joinTime(pickerValue));
    onClose();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={resolvedTitle}
      className={'max-h-[80vh] overflow-x-hidden'}
    >
      <div className={'relative mx-auto max-w-xs py-2'}>
        <div
          className={
            'border-border bg-surface-hover/40 pointer-events-none absolute top-1/2 right-4 left-4 z-10 h-11 -translate-y-1/2 rounded-lg border'
          }
        />
        <Picker
          value={pickerValue}
          onChange={handlePickerChange}
          height={220}
          itemHeight={44}
          wheelMode={'natural'}
          className={'relative z-20'}
        >
          <Picker.Column name={'hour'}>
            {hours.map((hour) => (
              <Picker.Item key={hour} value={hour}>
                {({ selected }) => (
                  <div
                    className={`flex h-11 items-center justify-center text-xl font-semibold ${
                      selected ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {hour === '00' ? hour : Number(hour)}
                  </div>
                )}
              </Picker.Item>
            ))}
          </Picker.Column>
          <Picker.Column name={'minute'}>
            {minuteOptions.map((minute) => (
              <Picker.Item key={minute} value={minute}>
                {({ selected }) => (
                  <div
                    className={`flex h-11 items-center justify-center text-xl font-semibold ${
                      selected ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {minute}
                  </div>
                )}
              </Picker.Item>
            ))}
          </Picker.Column>
        </Picker>
        <span
          className={
            'text-muted-foreground pointer-events-none absolute top-1/2 left-1/2 z-30 -translate-x-1/2 -translate-y-1/2 text-xl font-semibold'
          }
        >
          {':'}
        </span>
      </div>

      <div className={'mt-4 flex gap-3'}>
        <button
          type={'button'}
          onClick={onClose}
          className={
            'bg-card text-foreground flex-1 rounded-lg px-4 py-3 text-base font-medium transition-opacity active:opacity-70'
          }
        >
          {t('cancel')}
        </button>
        <button
          type={'button'}
          onClick={handleConfirm}
          className={
            'bg-brand flex-1 rounded-lg px-4 py-3 text-base font-medium text-white transition-opacity active:opacity-80'
          }
        >
          {t('done')}
        </button>
      </div>
    </BottomSheet>
  );
}
