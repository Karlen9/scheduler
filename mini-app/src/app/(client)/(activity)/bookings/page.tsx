'use client';

import { useState } from 'react';
import { CalendarX, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { BookingCard } from '@/components/BookingCard';
import { EmptyState } from '@/components/EmptyState';
import { BookingCardSkeleton } from '@/components/LoadingSkeleton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { api } from '@/lib/api';
import { Booking } from '@/lib/types';
import { useBookings } from '@/hooks/queries';
import { invalidateBookings } from '@/hooks/mutations';

export default function BookingsPage() {
  const t = useTranslations('BookingsPage');
  const te = useTranslations('Errors');
  const ts = useTranslations('Success');
  const { data: bookings, isLoading, error } = useBookings();
  const [cancelBookingTarget, setCancelBookingTarget] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showPast, setShowPast] = useState(false);

  const activeBookings = bookings
    .filter(
      (b) =>
        b.status === 'pending' ||
        b.status === 'confirmed' ||
        b.status === 'cancel_requested' ||
        b.status === 'reschedule_pending',
    )
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const pastBookings = bookings
    .filter((b) => b.status === 'completed' || b.status === 'cancelled' || b.status === 'rejected')
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  const handleCancelBooking = async () => {
    if (!cancelBookingTarget) return;
    try {
      await api.cancelBooking(cancelBookingTarget.id, cancelReason || t('cancelDefaultReason'));
      toast.success(ts('bookingCancelled'));
      setCancelBookingTarget(null);
      setCancelReason('');
      invalidateBookings();
    } catch {
      toast.error(te('bookingCancelFailed'));
    }
  };

  const handleConfirm = async (booking: Booking) => {
    try {
      await api.confirmBooking(booking.id);
      toast.success(ts('bookingConfirmed'));
      invalidateBookings();
    } catch {
      toast.error(te('bookingConfirmFailed'));
    }
  };

  const handleDecline = async (booking: Booking) => {
    try {
      await api.declineBooking(booking.id);
      toast.success(ts('bookingDeclined'));
      invalidateBookings();
    } catch {
      toast.error(te('bookingDeclineFailed'));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <h2 className="px-1 text-lg font-semibold">{t('title')}</h2>
        <div className="bg-card mb-3 h-4 w-28 animate-pulse rounded" />
        <div className="space-y-3">
          <BookingCardSkeleton />
          <BookingCardSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 p-4">
        <h2 className="px-1 text-lg font-semibold">{t('title')}</h2>
        <EmptyState
          icon={<CalendarX className="h-16 w-16" />}
          title={t('loadError')}
          description={t('loadErrorDescription')}
        />
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="space-y-4 p-4">
        <h2 className="px-1 text-lg font-semibold">{t('title')}</h2>
        <EmptyState
          icon={<CalendarX className="h-16 w-16" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-4 p-4">
        <h2 className="px-1 text-lg font-semibold">{t('title')}</h2>

        {activeBookings.length > 0 && (
          <div>
            <h3 className="text-muted-foreground mb-3 text-sm font-medium">
              {t('activeBookings')}
            </h3>
            <div className="space-y-3">
              {activeBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onCancel={setCancelBookingTarget}
                  onConfirm={
                    booking.status === 'pending' && booking.createdBy === 'trainer'
                      ? handleConfirm
                      : undefined
                  }
                  onDecline={
                    booking.status === 'pending' && booking.createdBy === 'trainer'
                      ? handleDecline
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        )}

        {pastBookings.length > 0 && (
          <div>
            <button
              onClick={() => setShowPast(!showPast)}
              className="text-muted-foreground mb-3 flex items-center gap-2 text-sm font-medium"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showPast ? 'rotate-0' : '-rotate-90'}`}
              />
              {t('pastBookings')} ({pastBookings.length})
            </button>
            {showPast && (
              <div className="space-y-3">
                {pastBookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!cancelBookingTarget}
        onClose={() => {
          setCancelBookingTarget(null);
          setCancelReason('');
        }}
        onConfirm={handleCancelBooking}
        title={t('cancelDialog')}
        description={t('cancelConfirmMessage')}
        confirmText={t('cancelConfirmButton')}
        destructive
        showInput
        inputPlaceholder={t('cancelReasonPlaceholder')}
        inputValue={cancelReason}
        onInputChange={setCancelReason}
      />
    </div>
  );
}
