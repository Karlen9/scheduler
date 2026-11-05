'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { PrimaryButton } from '@/components/PrimaryButton';
import { invalidateRecurring } from '@/hooks/mutations';
import { ProRequiredError } from '@/lib/api/shared';
import { generateTimeSlotsForDay } from '@/lib/helpers';
import { resolveTestAwareHref } from '@/lib/routes';

import { RecurringDayForm } from './RecurringDayForm';

import type { TRecurringBookingFlowProps, TSessionType } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the recurring booking flow UI and related interactions.
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
export function RecurringBookingFlow({
  services,
  workingHours,
  selectedClient,
  hasClientSelector,
  onCreateRecurring,
  onPreviewRecurring,
  successRedirect,
  readOnly = false,
  readOnlyActionLabel,
}: TRecurringBookingFlowProps): ReactNode {
  /***************************************************************************************************
   * Defines the router value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const router = useRouter();
  const pathname = usePathname();
  /***************************************************************************************************
   * Defines the t value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('BookingForm');
  /***************************************************************************************************
   * Defines the tc value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const tc = useTranslations('Common');
  /***************************************************************************************************
   * Defines the te value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const te = useTranslations('Errors');

  /***************************************************************************************************
   * State.
   ***************************************************************************************************/
  const [recService, setRecService] = useState<TSessionType | null>(null);
  const [dayTimeMap, setDayTimeMap] = useState<Record<number, string>>({});
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [previewDates, setPreviewDates] = useState<string[] | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  /***************************************************************************************************
   * Reset recurring preview when config changes.
   ***************************************************************************************************/
  useEffect(() => {
    setPreviewDates(null);
  }, [recService, dayTimeMap, selectedPeriod]);

  /***************************************************************************************************
   * Computed.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const timeSlotsForActiveDay = useMemo(
    () =>
      activeDay !== null
        ? generateTimeSlotsForDay(workingHours, activeDay, recService?.durationMinutes ?? 0)
        : [],
    [workingHours, activeDay, recService],
  );

  /***************************************************************************************************
   * Defines the configured days value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const configuredDays = Object.keys(dayTimeMap).map(Number);
  /***************************************************************************************************
   * Defines the has day times value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const hasDayTimes = configuredDays.length > 0;
  /***************************************************************************************************
   * Defines the rec form ready value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const recFormReady = !!(
    recService &&
    hasDayTimes &&
    selectedPeriod &&
    (!hasClientSelector || selectedClient)
  );

  /***************************************************************************************************
   * Handlers.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleDayClick = (day: number): void => {
    if (activeDay === day) {
      setDayTimeMap((prev) => {
        /***************************************************************************************************
         * Defines the next value used by the component layer.
         *
         * Usage context:
         * - Reused by the component layer to keep shared values centralized.
         ***************************************************************************************************/
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

  /***************************************************************************************************
   * Handles rec time select.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleRecTimeSelect = (time: string): void => {
    if (activeDay === null) {
      return;
    }
    setDayTimeMap((prev) => ({ ...prev, [activeDay]: time }));
    setActiveDay(null);
  };

  /***************************************************************************************************
   * Builds day times payload.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const buildDayTimesPayload = (): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const [day, time] of Object.entries(dayTimeMap)) {
      result[day] = time;
    }
    return result;
  };

  /***************************************************************************************************
   * Handles preview.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const handlePreview = async (): Promise<void> => {
    if (!recFormReady || !recService) {
      return;
    }
    setIsPreviewing(true);
    try {
      /***************************************************************************************************
       * Defines the result value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
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

  /***************************************************************************************************
   * Handles create schedule.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
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
      /***************************************************************************************************
       * Defines the rec desc value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const recDesc = selectedClient
        ? selectedClient.isSelf || selectedClient.isGhost
          ? t('successRecurringCreated')
          : t('successRecurringForClient', {
              name: selectedClient.displayName || selectedClient.name,
            })
        : t('successRecurringForSpecialist');
      toast.success(t('successRecurringTitle'), { description: recDesc });
      router.push(resolveTestAwareHref(pathname, successRedirect));
    } catch (err) {
      /***************************************************************************************************
       * Defines the msg value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      if (err instanceof ProRequiredError) {
        toast.error(te('scheduleCreateFailed'));
      } else {
        const msg = err instanceof Error ? err.message : te('scheduleCreateFailed');
        toast.error(msg);
      }
    } finally {
      setIsSaving(false);
    }
  };

  /***************************************************************************************************
   * Render.
   ***************************************************************************************************/
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
        readOnly={readOnly}
        readOnlyActionLabel={readOnlyActionLabel}
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
          <PrimaryButton onClick={handleCreateSchedule} disabled={isSaving || readOnly}>
            {readOnly
              ? (readOnlyActionLabel ?? t('submitRecurring'))
              : isSaving
                ? tc('saving')
                : t('submitRecurring')}
          </PrimaryButton>
        </div>
      )}
    </>
  );
}
