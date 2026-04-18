'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { BookingForm } from '@/components/BookingForm';
import { invalidateClients } from '@/hooks/mutations';
import { useAdminScheduleContext, useAdminServices, useClients } from '@/hooks/queries';
import { api } from '@/lib/api';

import type { ReactNode } from 'react';

function parseDateParam(raw: string | null): Date | undefined {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return undefined;
  }
  const [y, m, d] = raw.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  /***************************************************************************************************
   * Guard against silent overflow normalization (e.g. 2026-02-31 → 2026-03-03).
   ***************************************************************************************************/
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return undefined;
  }
  return date;
}

/***************************************************************************************************
 * Renders the admin book page UI and related interactions.
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
export default function AdminBookPage(): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('BookingForm');
  const { data: clients, isLoading: clientsLoading } = useClients();
  const { data: services, isLoading: svcLoading } = useAdminServices();
  const { data: scheduleData, isLoading: scheduleLoading } = useAdminScheduleContext();
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

  /***************************************************************************************************
   * Defines the days off value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const daysOff = daysOffData.map((d) => d.date);

  const searchParams = useSearchParams();
  const initialDate = useMemo(() => parseDateParam(searchParams.get('date')), [searchParams]);

  return (
    <BookingForm
      services={services}
      workingHours={workingHours}
      daysOff={daysOff}
      isLoading={clientsLoading || svcLoading || scheduleLoading}
      clients={clients}
      showRecurring={false}
      successRedirect={'/admin'}
      title={t('adminTitle')}
      initialDate={initialDate}
      onCreateGhostClient={async (name) => {
        /***************************************************************************************************
         * Defines the client value used by the page layer.
         *
         * Usage context:
         * - Reused by the page layer to keep shared values centralized.
         ***************************************************************************************************/
        const client = await api.admin.createGhostClient(name);
        invalidateClients();
        return client;
      }}
      onCreateBooking={async (params) => {
        await api.admin.createBooking({
          clientId: params.clientId!,
          sessionTypeId: params.sessionTypeId,
          duration: params.duration,
          date: params.date,
          time: params.time,
          message: params.message,
        });
      }}
      onCreateRecurring={async (params) => {
        await api.admin.createRecurringSchedule({
          clientId: params.clientId!,
          sessionTypeId: params.sessionTypeId,
          dayTimes: params.dayTimes,
          period: params.period,
        });
      }}
      onPreviewRecurring={async (params) => {
        return api.admin.previewRecurringSchedule({
          sessionTypeId: params.sessionTypeId,
          dayTimes: params.dayTimes,
          period: params.period,
        });
      }}
    />
  );
}
