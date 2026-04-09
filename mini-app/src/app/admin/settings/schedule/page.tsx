'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { PrimaryButton } from '@/components/PrimaryButton';
import { TimePickerModal } from '@/components/TimePickerModal';
import { TopBar } from '@/components/TopBar';
import { invalidateWorkingHours } from '@/hooks/mutations';
import { useAdminWorkingHours } from '@/hooks/queries';
import { api } from '@/lib/api';

import type { TDaySchedule, TWorkingHours, TWorkingInterval } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Lists translation or cache keys reused by the page layer.
 *
 * Usage context:
 * - Reused by the page layer to keep shared values centralized.
 ***************************************************************************************************/
const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const MAX_INTERVALS = 4;
const defaultIntervalsByDay: Record<number, TWorkingInterval> = {
  0: { startTime: '09:00', endTime: '18:00' },
  1: { startTime: '09:00', endTime: '21:00' },
  2: { startTime: '09:00', endTime: '21:00' },
  3: { startTime: '09:00', endTime: '21:00' },
  4: { startTime: '09:00', endTime: '21:00' },
  5: { startTime: '09:00', endTime: '21:00' },
  6: { startTime: '09:00', endTime: '18:00' },
};

function cloneInterval(interval: TWorkingInterval): TWorkingInterval {
  return { ...interval };
}

function buildDefaultInterval(day: number): TWorkingInterval {
  return cloneInterval(defaultIntervalsByDay[day]);
}

function createSchedule(enabledDays: number[]): Record<number, TDaySchedule> {
  const enabledSet = new Set(enabledDays);

  return {
    0: { enabled: enabledSet.has(0), intervals: [buildDefaultInterval(0)] },
    1: { enabled: enabledSet.has(1), intervals: [buildDefaultInterval(1)] },
    2: { enabled: enabledSet.has(2), intervals: [buildDefaultInterval(2)] },
    3: { enabled: enabledSet.has(3), intervals: [buildDefaultInterval(3)] },
    4: { enabled: enabledSet.has(4), intervals: [buildDefaultInterval(4)] },
    5: { enabled: enabledSet.has(5), intervals: [buildDefaultInterval(5)] },
    6: { enabled: enabledSet.has(6), intervals: [buildDefaultInterval(6)] },
  };
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function sortIntervals(intervals: TWorkingInterval[]): TWorkingInterval[] {
  return [...intervals].sort((a, b) => {
    const startDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    if (startDiff !== 0) {
      return startDiff;
    }

    return timeToMinutes(a.endTime) - timeToMinutes(b.endTime);
  });
}

function buildNewInterval(day: number, intervals: TWorkingInterval[]): TWorkingInterval {
  const sortedIntervals = sortIntervals(intervals);
  const preferredStart = timeToMinutes(defaultIntervalsByDay[day].startTime);
  const preferredEnd = timeToMinutes(defaultIntervalsByDay[day].endTime) - 60;
  const latestStart = 22 * 60;
  const ranges = [
    { start: preferredStart, end: preferredEnd },
    { start: 0, end: latestStart },
  ];

  for (const range of ranges) {
    for (let start = range.start; start <= range.end; start += 60) {
      const end = start + 60;
      const overlaps = sortedIntervals.some(
        (interval) =>
          start < timeToMinutes(interval.endTime) && end > timeToMinutes(interval.startTime),
      );
      if (!overlaps) {
        return {
          startTime: formatMinutes(start),
          endTime: formatMinutes(end),
        };
      }
    }
  }

  return buildDefaultInterval(day);
}

function isScheduleValid(schedule: Record<number, TDaySchedule>): boolean {
  return Object.values(schedule).every((daySchedule) => {
    if (!daySchedule.enabled) {
      return true;
    }
    if (daySchedule.intervals.length === 0) {
      return false;
    }

    const sortedIntervals = sortIntervals(daySchedule.intervals);
    let previousEnd = -1;

    for (const interval of sortedIntervals) {
      const start = timeToMinutes(interval.startTime);
      const end = timeToMinutes(interval.endTime);
      if (start >= end || start < previousEnd) {
        return false;
      }
      previousEnd = end;
    }

    return true;
  });
}

/***************************************************************************************************
 * Renders the schedule page UI and related interactions.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as ReactNode.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
export default function SchedulePage(): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('AdminSchedule');
  /***************************************************************************************************
   * Defines the tc value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const tc = useTranslations('Common');
  /***************************************************************************************************
   * Defines the tdat value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const tdat = useTranslations('Dates');
  /***************************************************************************************************
   * Defines the te value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const te = useTranslations('Errors');
  /***************************************************************************************************
   * Defines the ts value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const ts = useTranslations('Success');
  const { data: workingHours, isLoading } = useAdminWorkingHours();
  const [schedule, setSchedule] = useState<Record<number, TDaySchedule>>(() =>
    createSchedule([1, 2, 3, 4, 5]),
  );
  const [initialized, setInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [pickerTarget, setPickerTarget] = useState<{
    day: number;
    intervalIndex: number;
    type: 'start' | 'end';
  } | null>(null);

  useEffect(() => {
    if (isLoading || initialized) {
      return;
    }

    const newSchedule = createSchedule([]);

    workingHours.forEach((wh) => {
      if (!newSchedule[wh.dayOfWeek].enabled) {
        newSchedule[wh.dayOfWeek] = { enabled: true, intervals: [] };
      }

      newSchedule[wh.dayOfWeek].intervals.push({
        startTime: wh.startTime,
        endTime: wh.endTime,
      });
    });

    for (let day = 0; day < 7; day++) {
      if (newSchedule[day].enabled) {
        newSchedule[day].intervals = sortIntervals(newSchedule[day].intervals);
      }
    }

    setSchedule(newSchedule);
    setInitialized(true);
  }, [workingHours, isLoading, initialized]);

  /***************************************************************************************************
   * Handles day toggle.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleDayToggle = (day: number): void => {
    setSchedule((prev) => {
      const enabled = !prev[day].enabled;
      return {
        ...prev,
        [day]: {
          enabled,
          intervals:
            enabled && prev[day].intervals.length === 0
              ? [buildDefaultInterval(day)]
              : prev[day].intervals,
        },
      };
    });
  };

  /***************************************************************************************************
   * Defines the open time picker value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const openTimePicker = (day: number, intervalIndex: number, type: 'start' | 'end'): void => {
    setPickerTarget({ day, intervalIndex, type });
  };

  /***************************************************************************************************
   * Handles add interval.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleAddInterval = (day: number): void => {
    setSchedule((prev) => {
      if (prev[day].intervals.length >= MAX_INTERVALS) {
        return prev;
      }

      return {
        ...prev,
        [day]: {
          enabled: true,
          intervals: [...prev[day].intervals, buildNewInterval(day, prev[day].intervals)],
        },
      };
    });
  };

  /***************************************************************************************************
   * Handles delete interval.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleDeleteInterval = (day: number, intervalIndex: number): void => {
    setSchedule((prev) => {
      const intervals = prev[day].intervals.filter((_, index) => index !== intervalIndex);
      if (intervals.length === 0) {
        return {
          ...prev,
          [day]: {
            enabled: false,
            intervals: [buildDefaultInterval(day)],
          },
        };
      }

      return {
        ...prev,
        [day]: {
          ...prev[day],
          intervals,
        },
      };
    });
  };

  /***************************************************************************************************
   * Handles time select.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleTimeSelect = (time: string): void => {
    if (pickerTarget === null) {
      return;
    }

    setSchedule((prev) => ({
      ...prev,
      [pickerTarget.day]: {
        ...prev[pickerTarget.day],
        intervals: prev[pickerTarget.day].intervals.map((interval, index) =>
          index === pickerTarget.intervalIndex
            ? {
                ...interval,
                [pickerTarget.type === 'start' ? 'startTime' : 'endTime']: time,
              }
            : interval,
        ),
      },
    }));
    setPickerTarget(null);
  };

  /***************************************************************************************************
   * Handles save.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleSave = async (): Promise<void> => {
    if (!isScheduleValid(schedule)) {
      toast.error(t('invalidIntervals'));
      return;
    }

    setIsSaving(true);

    try {
      const hours: TWorkingHours[] = [];
      for (let day = 0; day < 7; day++) {
        if (schedule[day].enabled) {
          sortIntervals(schedule[day].intervals).forEach((interval) => {
            hours.push({
              dayOfWeek: day,
              startTime: interval.startTime,
              endTime: interval.endTime,
            });
          });
        }
      }

      await api.admin.updateWorkingHours(hours);
      invalidateWorkingHours();
      toast.success(ts('scheduleSaved'));
    } catch (err) {
      console.error('Failed to save working hours:', err);
      toast.error(te('saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div>
        <TopBar title={t('title')} showBack />
        <div className={'flex min-h-[200px] items-center justify-center p-4'}>
          <div className={'text-muted-foreground'}>{tc('loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title={t('title')} showBack />

      <div className={'space-y-6 p-4'}>
        {/***************************************************************************************************
         * Working Hours per Day.
         ***************************************************************************************************/}
        <div>
          <h3 className={'text-muted-foreground mb-3 text-sm'}>{t('workingDays')}</h3>
          <div className={'space-y-2'}>
            {[1, 2, 3, 4, 5, 6, 0].map((day) => (
              <div key={day} className={'bg-card rounded-lg p-3'}>
                <div className={'flex items-start gap-3'}>
                  <input
                    type={'checkbox'}
                    checked={schedule[day].enabled}
                    onChange={() => handleDayToggle(day)}
                    className={'border-border text-brand focus:ring-brand mt-1 h-5 w-5 rounded'}
                  />
                  <span className={'text-foreground w-8 pt-1 font-medium'}>
                    {tdat(`daysShort.${dayKeys[day]}`)}
                  </span>
                  <div className={'flex-1 space-y-2'}>
                    {schedule[day].enabled &&
                      schedule[day].intervals.map((interval, intervalIndex) => (
                        <div
                          key={`${day}-${interval.startTime}-${interval.endTime}-${intervalIndex}`}
                          className={'flex flex-wrap items-center gap-2 text-sm'}
                        >
                          <button
                            onClick={() => openTimePicker(day, intervalIndex, 'start')}
                            className={'bg-surface-hover text-foreground rounded px-3 py-1'}
                          >
                            {interval.startTime}
                          </button>
                          <span className={'text-muted-foreground'}>{'–'}</span>
                          <button
                            onClick={() => openTimePicker(day, intervalIndex, 'end')}
                            className={'bg-surface-hover text-foreground rounded px-3 py-1'}
                          >
                            {interval.endTime}
                          </button>
                          <button
                            onClick={() => handleDeleteInterval(day, intervalIndex)}
                            className={
                              'text-muted-foreground hover:text-foreground rounded px-2 py-1 text-xs'
                            }
                          >
                            {tc('delete')}
                          </button>
                        </div>
                      ))}
                    {schedule[day].enabled && schedule[day].intervals.length < MAX_INTERVALS && (
                      <button
                        onClick={() => handleAddInterval(day)}
                        className={'text-brand rounded px-1 py-1 text-sm font-medium'}
                      >
                        {'+ '}
                        {t('addInterval')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/***************************************************************************************************
         * Save Button.
         ***************************************************************************************************/}
        <PrimaryButton onClick={handleSave} disabled={isSaving}>
          {isSaving ? tc('saving') : tc('saveChanges')}
        </PrimaryButton>
      </div>

      {/***************************************************************************************************
       * Time Picker.
       ***************************************************************************************************/}
      <TimePickerModal
        isOpen={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        onSelect={handleTimeSelect}
        selectedTime={
          pickerTarget !== null
            ? (schedule[pickerTarget.day].intervals[pickerTarget.intervalIndex]?.[
                pickerTarget.type === 'start' ? 'startTime' : 'endTime'
              ] ??
              buildDefaultInterval(pickerTarget.day)[
                pickerTarget.type === 'start' ? 'startTime' : 'endTime'
              ])
            : '09:00'
        }
        title={pickerTarget?.type === 'start' ? t('startTime') : t('endTime')}
      />
    </div>
  );
}
