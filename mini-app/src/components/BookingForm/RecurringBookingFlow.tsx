'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { PrimaryButton } from '@/components/PrimaryButton';
import { invalidateRecurring } from '@/hooks/mutations';
import { generateTimeSlotsForDay } from '@/lib/helpers';

import { RecurringDayForm } from './RecurringDayForm';

import type {
  TClientInfo,
  TCreateRecurringParams,
  TPreviewRecurringParams,
  TSessionType,
  TWorkingHours,
} from '@/lib/types';
import type { ReactNode } from 'react';

export type TRecurringBookingFlowProps = {
  services: TSessionType[];
  workingHours: TWorkingHours[];
  selectedClient: TClientInfo | null;
  hasClientSelector: boolean;
  onCreateRecurring: (params: TCreateRecurringParams) => Promise<void>;
  onPreviewRecurring: (params: TPreviewRecurringParams) => Promise<{ dates: string[] }>;
  successRedirect: string;
};

export function RecurringBookingFlow({
  services,
  workingHours,
  selectedClient,
  hasClientSelector,
  onCreateRecurring,
  onPreviewRecurring,
  successRedirect,
}: TRecurringBookingFlowProps): ReactNode {
  const router = useRouter();
  const t = useTranslations('BookingForm');
  const tc = useTranslations('Common');
  const te = useTranslations('Errors');

  // ── State ──
  const [recService, setRecService] = useState<TSessionType | null>(null);
  const [dayTimeMap, setDayTimeMap] = useState<Record<number, string>>({});
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [previewDates, setPreviewDates] = useState<string[] | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ── Effects ──

  // Reset recurring preview when config changes
  useEffect(() => {
    setPreviewDates(null);
  }, [recService, dayTimeMap, selectedPeriod]);

  // ── Computed ──

  const timeSlotsForActiveDay = useMemo(
    () =>
      activeDay !== null
        ? generateTimeSlotsForDay(workingHours, activeDay, recService?.durationMinutes ?? 0)
        : [],
    [workingHours, activeDay, recService],
  );

  const configuredDays = Object.keys(dayTimeMap).map(Number);
  const hasDayTimes = configuredDays.length > 0;
  const recFormReady = !!(
    recService &&
    hasDayTimes &&
    selectedPeriod &&
    (!hasClientSelector || selectedClient)
  );

  // ── Handlers ──

  const handleDayClick = (day: number): void => {
    if (activeDay === day) {
      setDayTimeMap((prev) => {
        const next = { ...prev };
        delete next[day];
        return next;
      });
      setActiveDay(null);
    } else if (day in dayTimeMap) {
      setActiveDay(day);
    } else {
      setActiveDay(day);
    }
  };

  const handleRecTimeSelect = (time: string): void => {
    if (activeDay === null) {
      return;
    }
    setDayTimeMap((prev) => ({ ...prev, [activeDay]: time }));
    setActiveDay(null);
  };

  const buildDayTimesPayload = (): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const [day, time] of Object.entries(dayTimeMap)) {
      result[day] = time;
    }
    return result;
  };

  const handlePreview = async (): Promise<void> => {
    if (!recFormReady || !recService) {
      return;
    }
    setIsPreviewing(true);
    try {
      const result = await onPreviewRecurring({
        sessionTypeId: recService.id,
        dayTimes: buildDayTimesPayload(),
        period: selectedPeriod,
      });
      setPreviewDates(result.dates);
    } catch {
      toast.error(te('previewFailed'));
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleCreateSchedule = async (): Promise<void> => {
    if (!recFormReady || !recService) {
      return;
    }
    setIsSaving(true);
    try {
      await onCreateRecurring({
        clientId: selectedClient?.id,
        sessionTypeId: recService.id,
        dayTimes: buildDayTimesPayload(),
        period: selectedPeriod,
      });
      setRecService(null);
      setDayTimeMap({});
      setActiveDay(null);
      setSelectedPeriod('');
      setPreviewDates(null);
      invalidateRecurring();
      const recDesc = selectedClient
        ? t('successRecurringForClient', {
            name: selectedClient.displayName || selectedClient.name,
          })
        : t('successRecurringForSpecialist');
      toast.success(t('successRecurringTitle'), { description: recDesc });
      router.push(successRedirect);
    } catch (err) {
      const msg = err instanceof Error ? err.message : te('scheduleCreateFailed');
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ──

  return (
    <>
      <RecurringDayForm
        services={services}
        recService={recService}
        setRecService={setRecService}
        activeDay={activeDay}
        handleDayClick={handleDayClick}
        dayTimeMap={dayTimeMap}
        timeSlotsForActiveDay={timeSlotsForActiveDay}
        hasDayTimes={hasDayTimes}
        selectedPeriod={selectedPeriod}
        recFormReady={recFormReady}
        setSelectedPeriod={setSelectedPeriod}
        isPreviewing={isPreviewing}
        handlePreview={handlePreview}
        previewDates={previewDates}
        handleRecTimeSelect={handleRecTimeSelect}
      />

      {recFormReady && (
        <div
          className={
            'bg-background/80 fixed right-0 bottom-0 left-0 space-y-3 p-4 backdrop-blur-sm'
          }
          style={{ maxWidth: '430px', margin: '0 auto' }}
        >
          <PrimaryButton onClick={handleCreateSchedule} disabled={isSaving}>
            {isSaving ? tc('saving') : t('submitRecurring')}
          </PrimaryButton>
        </div>
      )}
    </>
  );
}
