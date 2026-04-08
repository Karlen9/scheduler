'use client';

import { useTranslations } from 'next-intl';
import { Suspense, useMemo } from 'react';

import { BookingForm } from '@/components/BookingForm';
import { useBookings, useScheduleContext, useSessionTypes } from '@/hooks/queries';
import { api } from '@/lib/api';
import { getUserName } from '@/lib/telegram';

import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the client book content UI and related interactions.
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
function ClientBookContent(): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('BookingForm');
  const { data: scheduleData, isLoading: scheduleLoading } = useScheduleContext();
  /***************************************************************************************************
   * Defines the working hours value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const workingHours = scheduleData?.workingHours ?? [];
  /***************************************************************************************************
   * Defines the days off data value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const daysOffData = scheduleData?.daysOff ?? [];
  const { data: services, isLoading: svcLoading } = useSessionTypes();
  const { data: bookings } = useBookings();

  /***************************************************************************************************
   * Defines the days off value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const daysOff = daysOffData.map((d) => d.date);

  /***************************************************************************************************
   * Defines the booked dates value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const bookedDates = useMemo(() => {
    return bookings
      .filter((b) => b.status === 'pending' || b.status === 'confirmed')
      .map((b) => b.startsAt.slice(0, 10));
  }, [bookings]);

  return (
    <BookingForm
      services={services}
      workingHours={workingHours}
      daysOff={daysOff}
      bookedDates={bookedDates}
      isLoading={scheduleLoading || svcLoading}
      showRecurring={false}
      successRedirect={'/bookings'}
      title={t('title')}
      onCreateBooking={async (params) => {
        /***************************************************************************************************
         * Defines the name value used by the page layer.
         *
         * Usage context:
         * - Reused by the page layer to keep shared values centralized.
         ***************************************************************************************************/
        const name = getUserName();
        await api.createBooking(params.duration, params.date, params.time, name, params.message);
      }}
      onCreateRecurring={async (params) => {
        await api.createRecurringSchedule({
          sessionTypeId: params.sessionTypeId,
          dayTimes: params.dayTimes,
          period: params.period,
        });
      }}
      onPreviewRecurring={async (params) => {
        return api.previewRecurringSchedule({
          sessionTypeId: params.sessionTypeId,
          dayTimes: params.dayTimes,
          period: params.period,
        });
      }}
    />
  );
}

/***************************************************************************************************
 * Renders the booking fallback UI and related interactions.
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
function BookingFallback(): ReactNode {
  /***************************************************************************************************
   * Defines the tc value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const tc = useTranslations('Common');
  return (
    <div className={'bg-background flex min-h-screen items-center justify-center'}>
      {tc('loading')}
    </div>
  );
}

/***************************************************************************************************
 * Renders the booking page UI and related interactions.
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
export default function BookingPage(): ReactNode {
  return (
    <Suspense fallback={<BookingFallback />}>
      <ClientBookContent />
    </Suspense>
  );
}
