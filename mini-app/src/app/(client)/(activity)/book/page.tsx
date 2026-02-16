"use client";

import { Suspense } from "react";
import { BookingForm } from "@/components/BookingForm";
import { api } from "@/lib/api";
import { getUserName } from "@/lib/telegram";
import { useWorkingHours, useDaysOff, useSessionTypes } from "@/hooks/queries";

function ClientBookContent() {
  const { data: workingHours, isLoading: whLoading } = useWorkingHours();
  const { data: daysOffData, isLoading: doLoading } = useDaysOff();
  const { data: services, isLoading: svcLoading } = useSessionTypes();

  const daysOff = daysOffData.map((d) => d.date);

  return (
    <BookingForm
      services={services}
      workingHours={workingHours}
      daysOff={daysOff}
      isLoading={whLoading || doLoading || svcLoading}
      successRedirect="/bookings"
      title="Онлайн запись"
      onCreateBooking={async (params) => {
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

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          Загрузка...
        </div>
      }
    >
      <ClientBookContent />
    </Suspense>
  );
}
