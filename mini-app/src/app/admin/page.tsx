'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { BookingDetailModal } from '@/components/BookingDetailModal';
import { BottomSheet } from '@/components/BottomSheet';
import { PendingBookingCard } from '@/components/PendingBookingCard';
import { RescheduleSheet } from '@/components/RescheduleSheet';
import { NextBookingBanner } from '@/components/schedule/NextBookingBanner';
import { ScheduleView } from '@/components/schedule/ScheduleView';
import { invalidateBookings } from '@/hooks/mutations';
import { useAdminBookings, useAdminScheduleContext, useClients } from '@/hooks/queries';
import { api } from '@/lib/api';
import { getNonWorkingDays } from '@/lib/helpers';

import { CancelDialog } from './CancelDialog';
import { RejectDialog } from './RejectDialog';
import { StatsSection } from './StatsSection';

import type { TBooking } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the admin home page UI and related interactions.
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
export default function AdminHomePage(): ReactNode {
  /***************************************************************************************************
   * Defines the router value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const router = useRouter();
  /***************************************************************************************************
   * Defines the t value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('AdminDashboard');
  /***************************************************************************************************
   * Defines the te value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const te = useTranslations('Errors');
  /***************************************************************************************************
   * Defines the ts value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const ts = useTranslations('Success');
  const {
    data: bookings,
    isLoading,
    error: fetchError,
  } = useAdminBookings({ refreshInterval: 15000 });
  const { data: scheduleContext } = useAdminScheduleContext();
  /***************************************************************************************************
   * Defines the working hours data value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const workingHoursData = scheduleContext?.workingHours ?? [];
  /***************************************************************************************************
   * Defines the days off data value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const daysOffData = scheduleContext?.daysOff ?? [];
  const { data: clients } = useClients();

  /***************************************************************************************************
   * Defines the non working days value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const nonWorkingDays = useMemo(() => getNonWorkingDays(workingHoursData), [workingHoursData]);

  /***************************************************************************************************
   * Defines the days off value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const daysOff = useMemo(() => daysOffData.map((d) => d.date), [daysOffData]);
  const [selectedBooking, setSelectedBooking] = useState<TBooking | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<TBooking | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [rescheduleBooking, setRescheduleBooking] = useState<TBooking | null>(null);
  const [showPendingSheet, setShowPendingSheet] = useState(false);

  /***************************************************************************************************
   * Defines the error value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const error = fetchError
    ? fetchError instanceof Error
      ? fetchError.message
      : t('loadError')
    : null;

  /***************************************************************************************************
   * Defines the pending bookings value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const pendingBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.status === 'pending' && b.createdBy !== 'specialist')
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [bookings],
  );

  /***************************************************************************************************
   * Defines the pending count value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const pendingCount = pendingBookings.length;

  /***************************************************************************************************
   * Defines the schedule bookings value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const scheduleBookings = useMemo(
    () => bookings.filter((b) => b.status === 'confirmed' || b.status === 'pending'),
    [bookings],
  );

  /***************************************************************************************************
   * Defines the next booking value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const nextBooking = useMemo(() => {
    /***************************************************************************************************
     * Defines the now value used by the page layer.
     *
     * Usage context:
     * - Reused by the page layer to keep shared values centralized.
     ***************************************************************************************************/
    const now = Date.now();
    return (
      bookings
        .filter((b) => b.status === 'confirmed' && new Date(b.startsAt).getTime() > now)
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0] || null
    );
  }, [bookings]);

  /***************************************************************************************************
   * Handles accept.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleAccept = async (booking: TBooking): Promise<void> => {
    try {
      await api.admin.updateBookingStatus(booking.id, 'confirmed');
      toast.success(ts('bookingConfirmed'));
      setSelectedBooking(null);
      await invalidateBookings();
    } catch {
      toast.error(te('bookingConfirmFailed'));
    }
  };

  /***************************************************************************************************
   * Handles reject click.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleRejectClick = (booking: TBooking): void => {
    setSelectedBooking(null);
    setRejectTarget(booking);
    setShowRejectDialog(true);
  };

  /***************************************************************************************************
   * Handles confirm reject.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleConfirmReject = async (): Promise<void> => {
    if (!rejectTarget) {
      return;
    }
    try {
      await api.admin.updateBookingStatus(rejectTarget.id, 'rejected', rejectReason || undefined);
      toast.success(ts('bookingRejected'));
      await invalidateBookings();
    } catch {
      toast.error(te('bookingRejectFailed'));
    }
    setShowRejectDialog(false);
    setRejectTarget(null);
    setRejectReason('');
  };

  /***************************************************************************************************
   * Handles booking click.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleBookingClick = (booking: TBooking): void => {
    setSelectedBooking(booking);
  };

  /***************************************************************************************************
   * Handles reschedule click.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleRescheduleClick = (booking: TBooking): void => {
    setSelectedBooking(null);
    setRescheduleBooking(booking);
  };

  /***************************************************************************************************
   * Handles cancel click.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleCancelClick = (): void => {
    setShowCancelDialog(true);
  };

  /***************************************************************************************************
   * Handles confirm cancel.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleConfirmCancel = async (): Promise<void> => {
    if (!selectedBooking) {
      return;
    }
    try {
      await api.admin.updateBookingStatus(
        selectedBooking.id,
        'cancelled',
        cancelReason || undefined,
      );
      toast.success(ts('bookingCancelled'));
      await invalidateBookings();
    } catch {
      toast.error(te('bookingCancelFailed'));
    }
    setShowCancelDialog(false);
    setSelectedBooking(null);
    setCancelReason('');
  };

  /***************************************************************************************************
   * Handles empty slot click.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleEmptySlotClick = (_date: Date, _time: string): void => {
    router.push('/admin/book');
  };

  if (isLoading) {
    return (
      <div className={'space-y-6 p-4'}>
        <div className={'animate-pulse'}>
          <div className={'bg-card mb-3 h-5 w-36 rounded'} />
          <div className={'bg-card h-24 rounded-xl'} />
        </div>
        <div className={'animate-pulse'}>
          <div className={'bg-card mb-3 h-5 w-28 rounded'} />
          <div className={'bg-card mb-4 h-10 rounded-xl'} />
          <div className={'bg-card mb-3 h-5 w-48 rounded'} />
          <div className={'space-y-2'}>
            <div className={'bg-card h-16 rounded-xl'} />
            <div className={'bg-card h-16 rounded-xl'} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={'p-4'}>
        <div className={'bg-action-danger-bg text-action-danger-text rounded-xl p-4 text-center'}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={'space-y-6 p-4'}>
        {/***************************************************************************************************
         * Next upcoming booking.
         ***************************************************************************************************/}
        <NextBookingBanner booking={nextBooking} onBookingClick={handleBookingClick} />

        {/***************************************************************************************************
         * Stats row.
         ***************************************************************************************************/}
        <StatsSection
          pendingCount={pendingCount}
          clientsCount={clients.length}
          onPendingClick={pendingCount > 0 ? () => setShowPendingSheet(true) : undefined}
          onClientsClick={() => router.push('/admin/clients')}
        />

        {/***************************************************************************************************
         * Schedule.
         ***************************************************************************************************/}
        <ScheduleView
          bookings={scheduleBookings}
          onBookingClick={handleBookingClick}
          nonWorkingDays={nonWorkingDays}
          daysOff={daysOff}
          workingHours={workingHoursData}
          onEmptySlotClick={handleEmptySlotClick}
        />
      </div>

      {/***************************************************************************************************
       * Reject dialog.
       ***************************************************************************************************/}
      <RejectDialog
        isOpen={showRejectDialog}
        targetName={rejectTarget?.clientDisplayName || rejectTarget?.clientName || ''}
        reason={rejectReason}
        onReasonChange={setRejectReason}
        onConfirm={handleConfirmReject}
        onClose={() => {
          setShowRejectDialog(false);
          setRejectTarget(null);
          setRejectReason('');
        }}
      />

      {/***************************************************************************************************
       * Booking detail modal.
       ***************************************************************************************************/}
      <BookingDetailModal
        booking={selectedBooking}
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onReschedule={handleRescheduleClick}
        onCancel={handleCancelClick}
        onAccept={handleAccept}
        onReject={handleRejectClick}
      />

      {/***************************************************************************************************
       * Reschedule sheet.
       ***************************************************************************************************/}
      <RescheduleSheet
        booking={rescheduleBooking}
        isOpen={!!rescheduleBooking}
        onClose={() => setRescheduleBooking(null)}
        onSuccess={() => {
          toast.success(ts('bookingRescheduled'));
          invalidateBookings();
        }}
      />

      {/***************************************************************************************************
       * Cancel dialog.
       ***************************************************************************************************/}
      <CancelDialog
        isOpen={showCancelDialog}
        targetName={selectedBooking?.clientDisplayName || selectedBooking?.clientName || ''}
        reason={cancelReason}
        onReasonChange={setCancelReason}
        onConfirm={handleConfirmCancel}
        onClose={() => {
          setShowCancelDialog(false);
          setCancelReason('');
        }}
      />

      {/***************************************************************************************************
       * Pending requests sheet.
       ***************************************************************************************************/}
      <BottomSheet
        isOpen={showPendingSheet}
        onClose={() => setShowPendingSheet(false)}
        title={t('newRequests')}
        className={'max-h-[70vh] overflow-y-auto'}
      >
        <div className={'space-y-3'}>
          {pendingBookings.map((booking) => (
            <PendingBookingCard
              key={booking.id}
              booking={booking}
              onAccept={async (b) => {
                await handleAccept(b);
                if (pendingBookings.length <= 1) {
                  setShowPendingSheet(false);
                }
              }}
              onReject={(b) => {
                setShowPendingSheet(false);
                handleRejectClick(b);
              }}
            />
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
