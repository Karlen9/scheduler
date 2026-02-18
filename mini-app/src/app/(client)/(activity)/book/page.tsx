'use client';

import { Suspense, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { BookingForm } from '@/components/BookingForm';
import { api } from '@/lib/api';
import { getUserName } from '@/lib/telegram';
import { useWorkingHours, useDaysOff, useSessionTypes, useBookings } from '@/hooks/queries';

function ClientBookContent() {
  const t = useTranslations('BookingForm');
  const tc = useTranslations('Common');
  const { data: workingHours, isLoading: whLoading } = useWorkingHours();
  const { data: daysOffData, isLoading: doLoading } = useDaysOff();
  const { data: services, isLoading: svcLoading } = useSessionTypes();
  const { data: bookings } = useBookings();

  const daysOff = daysOffData.map((d) => d.date);

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
      isLoading={whLoading || doLoading || svcLoading}
      showRecurring={false}
      successRedirect="/bookings"
      title={t('title')}
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

function BookingFallback() {
  const tc = useTranslations('Common');
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      {tc('loading')}
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={<BookingFallback />}>
      <ClientBookContent />
    </Suspense>
  );
}
