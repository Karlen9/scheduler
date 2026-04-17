'use client';

import { ChevronDown, Copy, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ConfirmDialog';
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
const dayOrder = [1, 2, 3, 4, 5, 6, 0] as const;
const MAX_INTERVALS = 4;
const START_MINUTES = 6 * 60;
const END_MINUTES = 24 * 60;
const STEP_MINUTES = 30;
const TIME_OPTIONS = Array.from(
  { length: (END_MINUTES - START_MINUTES) / STEP_MINUTES + 1 },
  (_, index) => {
    const totalMinutes = START_MINUTES + index * STEP_MINUTES;
    return formatMinutes(totalMinutes);
  },
);
const defaultIntervalsByDay: Record<number, TWorkingInterval> = {
  0: { startTime: '09:00', endTime: '18:00' },
  1: { startTime: '09:00', endTime: '20:00' },
  2: { startTime: '09:00', endTime: '20:00' },
  3: { startTime: '09:00', endTime: '20:00' },
  4: { startTime: '09:00', endTime: '20:00' },
  5: { startTime: '09:00', endTime: '20:00' },
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
  return (hours === 0 ? 24 : hours) * 60 + minutes;
}

function formatMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function formatSummaryTime(time: string): string {
  const [hours = '0', minutes = '00'] = time.split(':');
  const hourLabel = hours === '00' ? '00' : String(Number(hours));

  return minutes === '00' ? hourLabel : `${hourLabel}.${minutes}`;
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

function cloneIntervals(intervals: TWorkingInterval[]): TWorkingInterval[] {
  return sortIntervals(intervals).map(cloneInterval);
}

function buildNewInterval(day: number, intervals: TWorkingInterval[]): TWorkingInterval {
  const sortedIntervals = sortIntervals(intervals);
  if (sortedIntervals.length === 0) {
    return buildDefaultInterval(day);
  }

  const previousInterval = sortedIntervals[sortedIntervals.length - 1];
  const startMinutes = timeToMinutes(previousInterval.endTime) + 60;
  const endMinutes = END_MINUTES;

  if (startMinutes < endMinutes) {
    return {
      startTime: formatMinutes(startMinutes),
      endTime: formatMinutes(endMinutes),
    };
  }

  return buildDefaultInterval(day);
}

function getDayErrorKey(daySchedule: TDaySchedule): string | null {
  if (!daySchedule.enabled) {
    return null;
  }
  if (daySchedule.intervals.length === 0) {
    return 'emptyIntervals';
  }

  const sortedIntervals = sortIntervals(daySchedule.intervals);
  let previousEnd = -1;

  for (const interval of sortedIntervals) {
    const start = timeToMinutes(interval.startTime);
    const end = timeToMinutes(interval.endTime);
    if (start >= end) {
      return 'invalidRange';
    }
    if (start < previousEnd) {
      return 'overlapIntervals';
    }
    previousEnd = end;
  }

  return null;
}

function isScheduleValid(schedule: Record<number, TDaySchedule>): boolean {
  return Object.values(schedule).every((daySchedule) => getDayErrorKey(daySchedule) === null);
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
  const [expandedDay, setExpandedDay] = useState<number>(1);
  const [copySourceDay, setCopySourceDay] = useState<number | null>(null);
  const [copyTargetDays, setCopyTargetDays] = useState<number[]>([]);

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
      if (enabled) {
        setExpandedDay(day);
      }

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
          intervals: sortIntervals([
            ...prev[day].intervals,
            buildNewInterval(day, prev[day].intervals),
          ]),
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
   * Handles copy day.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleCopyDay = (sourceDay: number, targetDays: number[]): void => {
    setSchedule((prev) => {
      const source = prev[sourceDay];
      const copiedIntervals = cloneIntervals(source.intervals);
      const next = { ...prev };

      targetDays.forEach((day) => {
        if (day === sourceDay) {
          return;
        }
        next[day] = {
          enabled: source.enabled,
          intervals:
            copiedIntervals.length > 0
              ? cloneIntervals(copiedIntervals)
              : [buildDefaultInterval(day)],
        };
      });

      return next;
    });
    toast.success(t('copied'));
  };

  /***************************************************************************************************
   * Opens copy target selector.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const openCopySelector = (sourceDay: number): void => {
    setCopySourceDay(sourceDay);
    setCopyTargetDays(dayOrder.filter((day) => day !== sourceDay));
  };

  /***************************************************************************************************
   * Handles copy target toggle.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleCopyTargetToggle = (day: number): void => {
    setCopyTargetDays((prev) =>
      prev.includes(day) ? prev.filter((targetDay) => targetDay !== day) : [...prev, day],
    );
  };

  /***************************************************************************************************
   * Handles confirm copy selection.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleConfirmCopySelection = (): void => {
    if (copySourceDay === null || copyTargetDays.length === 0) {
      return;
    }

    handleCopyDay(copySourceDay, copyTargetDays);
    setCopySourceDay(null);
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

    setSchedule((prev) => {
      const updatedIntervals = sortIntervals(
        prev[pickerTarget.day].intervals.map((interval, index) =>
          index === pickerTarget.intervalIndex
            ? {
                ...interval,
                [pickerTarget.type === 'start' ? 'startTime' : 'endTime']: time,
              }
            : interval,
        ),
      );

      return {
        ...prev,
        [pickerTarget.day]: {
          ...prev[pickerTarget.day],
          intervals: updatedIntervals,
        },
      };
    });
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

  const getDaySummary = (daySchedule: TDaySchedule): string => {
    if (!daySchedule.enabled) {
      return t('closed');
    }

    return sortIntervals(daySchedule.intervals)
      .map(
        (interval) =>
          `${formatSummaryTime(interval.startTime)}-${formatSummaryTime(interval.endTime)}`,
      )
      .join(', ');
  };

  const expandedDaySchedule = schedule[expandedDay];
  const expandedDayErrorKey = expandedDaySchedule ? getDayErrorKey(expandedDaySchedule) : null;

  return (
    <div>
      <TopBar title={t('title')} showBack />

      <div className={'space-y-5 px-4 pt-4 pb-28'}>
        {/***************************************************************************************************
         * Working Hours per Day.
         ***************************************************************************************************/}
        <div className={'space-y-3'}>
          <div>
            <h3 className={'text-foreground text-base font-semibold'}>{t('workingDays')}</h3>
            <p className={'text-muted-foreground mt-1 text-sm'}>{t('scheduleHint')}</p>
          </div>

          <div className={'space-y-2'}>
            {dayOrder.map((day) => {
              const daySchedule = schedule[day];
              const isExpanded = expandedDay === day;
              const dayErrorKey = getDayErrorKey(daySchedule);

              return (
                <div
                  key={day}
                  className={`bg-card overflow-hidden rounded-lg border transition-colors ${
                    dayErrorKey ? 'border-destructive/60' : 'border-transparent'
                  }`}
                >
                  <div className={'flex items-center gap-3 p-3'}>
                    <button
                      type={'button'}
                      onClick={() => handleDayToggle(day)}
                      role={'switch'}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                        daySchedule.enabled ? 'bg-brand' : 'bg-switch-background'
                      }`}
                      aria-checked={daySchedule.enabled}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          daySchedule.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>

                    <button
                      type={'button'}
                      onClick={() =>
                        daySchedule.enabled ? setExpandedDay(isExpanded ? -1 : day) : undefined
                      }
                      className={'flex min-w-0 flex-1 items-center gap-3 text-left'}
                    >
                      <span className={'text-foreground w-9 shrink-0 text-base font-semibold'}>
                        {tdat(`daysShort.${dayKeys[day]}`)}
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate text-sm ${
                          daySchedule.enabled ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {getDaySummary(daySchedule)}
                      </span>
                    </button>
                    <div className={'flex h-9 w-[72px] shrink-0 items-center justify-end'}>
                      {daySchedule.enabled && (
                        <>
                          <button
                            type={'button'}
                            onClick={() => openCopySelector(day)}
                            className={
                              'text-muted-foreground hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors'
                            }
                            aria-label={t('copyDay')}
                          >
                            <Copy className={'h-4 w-4'} />
                          </button>
                          <button
                            type={'button'}
                            onClick={() => setExpandedDay(isExpanded ? -1 : day)}
                            className={
                              'text-muted-foreground hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors'
                            }
                            aria-label={isExpanded ? t('collapseDay') : t('expandDay')}
                          >
                            <ChevronDown
                              className={`text-muted-foreground h-4 w-4 shrink-0 transition-transform ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {dayErrorKey && (
                    <p className={'text-destructive px-3 pb-3 text-sm'}>{t(dayErrorKey)}</p>
                  )}

                  {isExpanded && daySchedule.enabled && (
                    <div className={'border-border border-t px-3 pt-3 pb-4'}>
                      <div className={'space-y-3'}>
                        <div className={'space-y-2'}>
                          {daySchedule.intervals.map((interval, intervalIndex) => (
                            <div
                              key={`${day}-${interval.startTime}-${interval.endTime}-${intervalIndex}`}
                              className={'flex items-center gap-2'}
                            >
                              <button
                                type={'button'}
                                onClick={() => openTimePicker(day, intervalIndex, 'start')}
                                className={
                                  'bg-background text-foreground min-w-0 flex-1 rounded-lg px-3 py-3 text-sm font-semibold'
                                }
                              >
                                {interval.startTime}
                              </button>
                              <span className={'text-muted-foreground'}>{'–'}</span>
                              <button
                                type={'button'}
                                onClick={() => openTimePicker(day, intervalIndex, 'end')}
                                className={
                                  'bg-background text-foreground min-w-0 flex-1 rounded-lg px-3 py-3 text-sm font-semibold'
                                }
                              >
                                {interval.endTime}
                              </button>
                              <button
                                type={'button'}
                                onClick={() => handleDeleteInterval(day, intervalIndex)}
                                className={
                                  'text-muted-foreground hover:text-destructive flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors'
                                }
                                aria-label={tc('delete')}
                              >
                                <Trash2 className={'h-4 w-4'} />
                              </button>
                            </div>
                          ))}
                        </div>

                        {daySchedule.intervals.length < MAX_INTERVALS && (
                          <button
                            type={'button'}
                            onClick={() => handleAddInterval(day)}
                            className={
                              'border-brand/30 text-brand flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-sm font-semibold'
                            }
                          >
                            <Plus className={'h-4 w-4'} />
                            {t('addWorkingTime')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className={'bg-background border-border fixed right-0 bottom-0 left-0 z-20 border-t p-4'}
      >
        <div className={'mx-auto max-w-[430px]'}>
          {expandedDayErrorKey && (
            <p className={'text-destructive mb-2 text-center text-sm'}>{t(expandedDayErrorKey)}</p>
          )}
          <PrimaryButton onClick={handleSave} disabled={isSaving}>
            {isSaving ? tc('saving') : tc('saveChanges')}
          </PrimaryButton>
        </div>
      </div>

      {/***************************************************************************************************
       * Time Picker.
       ***************************************************************************************************/}
      <TimePickerModal
        isOpen={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        onSelect={handleTimeSelect}
        availableTimes={TIME_OPTIONS}
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

      <ConfirmDialog
        isOpen={copySourceDay !== null}
        onClose={() => setCopySourceDay(null)}
        onConfirm={handleConfirmCopySelection}
        title={t('copyForTitle')}
        description={t('copyForDescription')}
        confirmText={t('copyConfirm')}
        confirmDisabled={copyTargetDays.length === 0}
      >
        <div className={'mb-4 flex flex-wrap gap-2'}>
          {dayOrder
            .filter((day) => day !== copySourceDay)
            .map((day) => {
              const selected = copyTargetDays.includes(day);
              return (
                <button
                  key={day}
                  type={'button'}
                  onClick={() => handleCopyTargetToggle(day)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    selected
                      ? 'bg-brand text-white'
                      : 'bg-surface-hover text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tdat(`daysShort.${dayKeys[day]}`)}
                </button>
              );
            })}
        </div>
      </ConfirmDialog>
    </div>
  );
}
