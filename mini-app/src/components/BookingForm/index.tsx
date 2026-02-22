'use client';

import { useState, useMemo, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarSkeleton } from '@/components/LoadingSkeleton';
import { ClientAvatar } from '@/components/ClientAvatar';
import { BookingFormProps, ClientInfo } from '@/lib/types';
import { ClientSelector } from './ClientSelector';
import { OnetimeBookingFlow } from './OnetimeBookingFlow';
import { RecurringBookingFlow } from './RecurringBookingFlow';

// ──── Main Component ────

export function BookingForm({
  services,
  workingHours: workingHoursData,
  daysOff,
  isLoading: isInitialLoading,
  clients,
  showRecurring = true,
  bookedDates,
  onCreateBooking,
  onCreateRecurring,
  onPreviewRecurring,
  onCreateGhostClient,
  successRedirect,
  title,
}: BookingFormProps): ReactNode {
  const t = useTranslations('BookingForm');
  const tc = useTranslations('Common');

  const hasClientSelector = !!clients;
  const resolvedTitle = title ?? t('title');

  // ── Client selection (admin only) ──
  const [selectedClient, setSelectedClient] = useState<ClientInfo | null>(null);

  // ── Top-level mode ──
  const [bookingType, setBookingType] = useState<'onetime' | 'recurring'>('onetime');

  // ── Shared computed ──
  const nonWorkingDays = useMemo(() => {
    const workingDaySet = new Set(workingHoursData.map((wh) => wh.dayOfWeek));
    const result: number[] = [];
    for (let i = 0; i < 7; i++) {
      if (!workingDaySet.has(i)) result.push(i);
    }
    return result;
  }, [workingHoursData]);

  const showForm = !hasClientSelector || selectedClient;

  // ── Render ──

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4 p-4 pb-48">
        <h2 className="px-1 text-lg font-semibold">{resolvedTitle}</h2>

        <ClientSelector
          clients={clients}
          onCreateGhostClient={onCreateGhostClient}
          setSelectedClient={setSelectedClient}
          selectedClient={selectedClient}
        />

        {/* Selected client header (admin) */}
        {hasClientSelector && selectedClient && (
          <div className="bg-card flex items-center gap-3 rounded-xl p-3">
            <ClientAvatar
              name={selectedClient.displayName || selectedClient.name}
              photoUrl={selectedClient.photoUrl}
            />
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate text-sm font-medium">
                {selectedClient.displayName || selectedClient.name}
                {selectedClient.isGhost && (
                  <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                    {tc('ghost')}
                  </span>
                )}
              </p>
              {selectedClient.phone && (
                <p className="text-muted-foreground text-xs">{selectedClient.phone}</p>
              )}
            </div>
            <button
              onClick={() => setSelectedClient(null)}
              className="text-brand text-xs font-medium"
            >
              {t('changeClient')}
            </button>
          </div>
        )}

        {/* Booking form */}
        {showForm && (
          <>
            {/* Top-level toggle: one-time / recurring */}
            {showRecurring && (
              <div className="bg-card flex rounded-xl p-1">
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

            {isInitialLoading ? (
              <div className="animate-pulse space-y-4">
                <div>
                  <div className="bg-card mb-2 h-4 w-28 rounded" />
                  <div className="space-y-3">
                    <div className="bg-card h-20 rounded-xl" />
                    <div className="bg-card h-20 rounded-xl" />
                  </div>
                </div>
                <div>
                  <div className="bg-card mb-2 h-4 w-24 rounded" />
                  <CalendarSkeleton />
                </div>
              </div>
            ) : bookingType === 'onetime' ? (
              <OnetimeBookingFlow
                services={services}
                daysOff={daysOff}
                bookedDates={bookedDates}
                showRecurring={showRecurring}
                selectedClient={selectedClient}
                hasClientSelector={hasClientSelector}
                nonWorkingDays={nonWorkingDays}
                onCreateBooking={onCreateBooking}
                successRedirect={successRedirect}
              />
            ) : (
              <RecurringBookingFlow
                services={services}
                workingHours={workingHoursData}
                selectedClient={selectedClient}
                hasClientSelector={hasClientSelector}
                onCreateRecurring={onCreateRecurring}
                onPreviewRecurring={onPreviewRecurring}
                successRedirect={successRedirect}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
