'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { ClientAvatar } from '@/components/ClientAvatar';
import { CalendarSkeleton } from '@/components/LoadingSkeleton';
import { useAdminClientBatches } from '@/hooks/queries';
import { getNonWorkingDays } from '@/lib/helpers';
import { weeklyHoursFromIntervals } from '@/lib/work-calendar';

import { ClientSelector } from './ClientSelector';
import { OnetimeBookingFlow } from './OnetimeBookingFlow';
import { RecurringBookingFlow } from './RecurringBookingFlow';

import type { TBookingFormProps, TClientInfo } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the booking form UI and related interactions.
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
export function BookingForm({
  services,
  workingHours: workingHoursData,
  daysOff,
  openDates,
  defaultIntervals,
  isLoading: isInitialLoading,
  clients,
  showRecurring = true,
  bookedDates,
  clientBatches,
  onCreateBooking,
  onCreateRecurring,
  onPreviewRecurring,
  onCreateGhostClient,
  successRedirect,
  readOnly = false,
  readOnlyActionLabel,
  title,
  initialDate,
  initialService,
  initialTime,
  initialComment,
  initialSelectedClient,
}: TBookingFormProps): ReactNode {
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
   * Defines the has client selector value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const hasClientSelector = !!clients;
  /***************************************************************************************************
   * Defines the resolved title value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const resolvedTitle = title ?? t('title');

  /***************************************************************************************************
   * Client selection (admin only).
   ***************************************************************************************************/
  const [selectedClient, setSelectedClient] = useState<TClientInfo | null>(
    initialSelectedClient ?? null,
  );

  /***************************************************************************************************
   * Top-level mode.
   ***************************************************************************************************/
  const [bookingType, setBookingType] = useState<'onetime' | 'recurring'>('onetime');

  /***************************************************************************************************
   * Defines the non working days value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  // Dates mode is signalled by `openDates`: weekday rules do not apply, only the opened dates do.
  const isDatesMode = openDates !== undefined;
  const nonWorkingDays = useMemo(
    () => (isDatesMode ? [] : getNonWorkingDays(workingHoursData)),
    [isDatesMode, workingHoursData],
  );

  /***************************************************************************************************
   * Defines the show form value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const showForm = !hasClientSelector || selectedClient;

  /***************************************************************************************************
   * Whose batches decide which batch services are selectable:
   * - client app: the signed-in client's own batches (passed in by the page);
   * - specialist: the batches of the CLIENT SELECTED for this booking, loaded here. Before a client
   *   is selected there are none, so batch services stay disabled.
   ***************************************************************************************************/
  const isSpecialistFlow = hasClientSelector || initialSelectedClient !== undefined;
  const { data: specialistClientBatches, isLoading: specialistBatchesLoading } =
    useAdminClientBatches(isSpecialistFlow ? selectedClient?.id : undefined);
  const effectiveBatches = isSpecialistFlow ? specialistClientBatches : clientBatches;
  const isLoadingForm = isInitialLoading || (isSpecialistFlow && specialistBatchesLoading);

  // Clients cannot create a recurring series when the schedule works by dates; the specialist can,
  // and the series is generated only on the opened dates.
  const recurringAllowed = showRecurring && !(isDatesMode && !isSpecialistFlow);
  const recurringWorkingHours = useMemo(
    () => (isDatesMode ? weeklyHoursFromIntervals(defaultIntervals ?? []) : workingHoursData),
    [isDatesMode, defaultIntervals, workingHoursData],
  );

  /***************************************************************************************************
   * Render.
   ***************************************************************************************************/
  return (
    <div className={'flex flex-col'}>
      <div className={'flex-1 space-y-4 p-4 pb-0'}>
        <h2 className={'px-1 text-lg font-semibold'}>{resolvedTitle}</h2>

        <ClientSelector
          clients={clients}
          onCreateGhostClient={onCreateGhostClient}
          setSelectedClient={setSelectedClient}
          selectedClient={selectedClient}
        />

        {/***************************************************************************************************
         * Selected client header (admin).
         ***************************************************************************************************/}
        {hasClientSelector && selectedClient && (
          <div className={'bg-card flex items-center gap-3 rounded-xl p-3'}>
            <ClientAvatar
              name={selectedClient.displayName || selectedClient.name}
              photoUrl={selectedClient.photoUrl}
              isSelf={selectedClient.isSelf}
            />
            <div className={'min-w-0 flex-1'}>
              <p className={'text-foreground truncate text-sm font-medium'}>
                {selectedClient.isSelf ? (
                  tc('self')
                ) : (
                  <>
                    {selectedClient.displayName || selectedClient.name}
                    {selectedClient.isGhost && (
                      <span className={'text-muted-foreground ml-1.5 text-xs font-normal'}>
                        {tc('ghost')}
                      </span>
                    )}
                  </>
                )}
              </p>
              {!selectedClient.isSelf && selectedClient.phone && (
                <p className={'text-muted-foreground text-xs'}>{selectedClient.phone}</p>
              )}
            </div>
            <button
              onClick={() => setSelectedClient(null)}
              className={'text-brand text-xs font-medium'}
            >
              {t('changeClient')}
            </button>
          </div>
        )}

        {/***************************************************************************************************
         * Booking form.
         ***************************************************************************************************/}
        {showForm && (
          <>
            {/***************************************************************************************************
             * Top-level toggle: one-time / recurring.
             ***************************************************************************************************/}
            {recurringAllowed && (
              <div className={'bg-card flex rounded-xl p-1'}>
                <button
                  onClick={() => setBookingType('onetime')}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                    bookingType === 'onetime' ? 'bg-brand text-white' : 'text-muted-foreground'
                  }`}
                >
                  {t('oneTime')}
                </button>
                <button
                  onClick={() => setBookingType('recurring')}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                    bookingType === 'recurring' ? 'bg-brand text-white' : 'text-muted-foreground'
                  }`}
                >
                  {t('recurring')}
                </button>
              </div>
            )}

            {recurringAllowed && isDatesMode && bookingType === 'recurring' && (
              <p className={'text-muted-foreground px-1 text-xs'}>{t('recurringDatesHint')}</p>
            )}

            {isLoadingForm ? (
              <div className={'animate-pulse space-y-4'}>
                <div>
                  <div className={'bg-card mb-2 h-4 w-28 rounded'} />
                  <div className={'space-y-3'}>
                    <div className={'bg-card h-20 rounded-xl'} />
                    <div className={'bg-card h-20 rounded-xl'} />
                  </div>
                </div>
                <div>
                  <div className={'bg-card mb-2 h-4 w-24 rounded'} />
                  <CalendarSkeleton />
                </div>
              </div>
            ) : bookingType === 'onetime' ? (
              <OnetimeBookingFlow
                services={services}
                daysOff={daysOff}
                openDates={openDates}
                bookedDates={bookedDates}
                clientBatches={effectiveBatches}
                showRecurring={recurringAllowed}
                selectedClient={selectedClient}
                hasClientSelector={hasClientSelector}
                nonWorkingDays={nonWorkingDays}
                onCreateBooking={onCreateBooking}
                successRedirect={successRedirect}
                readOnly={readOnly}
                readOnlyActionLabel={readOnlyActionLabel}
                initialDate={initialDate}
                initialService={initialService}
                initialTime={initialTime}
                initialComment={initialComment}
              />
            ) : (
              <RecurringBookingFlow
                services={services}
                clientBatches={effectiveBatches}
                workingHours={recurringWorkingHours}
                selectedClient={selectedClient}
                hasClientSelector={hasClientSelector}
                onCreateRecurring={onCreateRecurring}
                onPreviewRecurring={onPreviewRecurring}
                successRedirect={successRedirect}
                readOnly={readOnly}
                readOnlyActionLabel={readOnlyActionLabel}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
