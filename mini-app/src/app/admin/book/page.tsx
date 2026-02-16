"use client";

import { BookingForm } from "@/components/BookingForm";
import { api } from "@/lib/api";
import { useClients, useAdminServices, useWorkingHours, useDaysOff } from "@/hooks/queries";
import { invalidateClients } from "@/hooks/mutations";

export default function AdminBookPage() {
  const { data: clients, isLoading: clientsLoading } = useClients();
  const { data: services, isLoading: svcLoading } = useAdminServices();
  const { data: workingHours, isLoading: whLoading } = useWorkingHours();
  const { data: daysOffData, isLoading: doLoading } = useDaysOff();

  const daysOff = daysOffData.map((d) => d.date);

  return (
    <BookingForm
      services={services}
      workingHours={workingHours}
      daysOff={daysOff}
      isLoading={clientsLoading || svcLoading || whLoading || doLoading}
      clients={clients}
      showRecurring={false}
      successRedirect="/admin"
      title="Записать клиента"
      onCreateGhostClient={async (name) => {
        const client = await api.admin.createGhostClient(name);
        invalidateClients();
        return client;
      }}
      onCreateBooking={async (params) => {
        await api.admin.createBooking({
          clientId: params.clientId!,
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
