'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';

import { BookingForm } from '@/components/BookingForm';
import { ClientAvatar } from '@/components/ClientAvatar';
import { useAdminScheduleContext, useAdminServices, useClients } from '@/hooks/queries';
import { api } from '@/lib/api';
import { parseDateParam } from '@/lib/helpers';
import { resolveTestAwareHref } from '@/lib/routes';

import type { ReactNode } from 'react';

export default function AdminChooseClientBookPage(): ReactNode {
  const t = useTranslations('BookingForm');
  const tc = useTranslations('Common');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');
  const initialDate = useMemo(() => parseDateParam(searchParams.get('date')), [searchParams]);
  const initialServiceId = searchParams.get('service');
  const initialTime = searchParams.get('time') ?? undefined;
  const initialComment = searchParams.get('comment') ?? undefined;

  const { data: clients, isLoading: clientsLoading } = useClients();
  const { data: services, isLoading: svcLoading } = useAdminServices();
  const { data: scheduleData, isLoading: scheduleLoading } = useAdminScheduleContext();

  const initialService = useMemo(
    () => (initialServiceId ? services.find((s) => s.id === initialServiceId) : undefined),
    [services, initialServiceId],
  );

  const workingHours = scheduleData?.workingHours ?? [];
  const daysOff = (scheduleData?.daysOff ?? []).map((d) => d.date);

  const selectedClient = useMemo(
    () => (clientId ? clients.find((c) => c.id === clientId) : undefined),
    [clients, clientId],
  );

  /***************************************************************************************************
   * If no clientId or the id doesn't match any loaded client, bounce back to the picker so the
   * admin isn't stuck on a dead-end page. Preserves the rest of the search params.
   ***************************************************************************************************/
  const shouldRedirectToPicker = !clientId || (!clientsLoading && !selectedClient);
  useEffect(() => {
    if (!shouldRedirectToPicker) {
      return;
    }
    const next = new URLSearchParams();
    for (const [key, value] of searchParams.entries()) {
      if (key !== 'clientId') {
        next.append(key, value);
      }
    }
    const base = resolveTestAwareHref(pathname, '/admin/choose-client');
    const query = next.toString();
    router.replace(query ? `${base}?${query}` : base);
  }, [shouldRedirectToPicker, pathname, router, searchParams]);

  if (shouldRedirectToPicker || (clientsLoading && !selectedClient)) {
    return (
      <div className={'flex min-h-[50vh] items-center justify-center text-sm'}>{tc('loading')}</div>
    );
  }

  if (!selectedClient) {
    return null;
  }

  return (
    <div className={'flex flex-col'}>
      <div className={'bg-card mx-4 mt-4 flex items-center gap-3 rounded-xl p-3'}>
        <ClientAvatar
          name={selectedClient.displayName || selectedClient.name}
          photoUrl={selectedClient.photoUrl}
        />
        <div className={'min-w-0 flex-1'}>
          <p className={'text-foreground truncate text-sm font-medium'}>
            {selectedClient.displayName || selectedClient.name}
            {selectedClient.isGhost && (
              <span className={'text-muted-foreground ml-1.5 text-xs font-normal'}>
                {tc('ghost')}
              </span>
            )}
          </p>
          {selectedClient.phone && (
            <p className={'text-muted-foreground text-xs'}>{selectedClient.phone}</p>
          )}
        </div>
      </div>

      <BookingForm
        services={services}
        workingHours={workingHours}
        daysOff={daysOff}
        isLoading={svcLoading || scheduleLoading}
        showRecurring={false}
        successRedirect={'/admin'}
        title={t('adminTitle')}
        initialDate={initialDate}
        initialService={initialService}
        initialTime={initialTime}
        initialComment={initialComment}
        initialSelectedClient={selectedClient}
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
    </div>
  );
}
