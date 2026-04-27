'use client';

import { CalendarX, ChevronDown } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { BookingCard } from '@/components/BookingCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { BookingCardSkeleton } from '@/components/LoadingSkeleton';
import { invalidateBookings } from '@/hooks/mutations';
import { useBookingsPage } from '@/hooks/queries';
import { useRescheduleActions } from '@/hooks/useRescheduleActions';
import { api } from '@/lib/api';
import { isPreviewRoute } from '@/lib/routes';

import type { TBooking } from '@/lib/types';
import type { ReactNode } from 'react';

const PAST_STATUSES = new Set<TBooking['status']>(['completed', 'cancelled', 'rejected']);
const ACTIVE_STATUSES = new Set<TBooking['status']>([
  'pending',
  'confirmed',
  'cancel_requested',
  'reschedule_pending',
]);
const BOOKINGS_PAGE_LIMIT = 20;

function isPastBooking(booking: TBooking, now: number): boolean {
  return PAST_STATUSES.has(booking.status) || new Date(booking.startsAt).getTime() <= now;
}

/***************************************************************************************************
 * Renders the bookings page UI and related interactions.
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
export default function BookingsPage(): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('BookingsPage');
  const tc = useTranslations('Common');
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
  const pathname = usePathname();
  const [page, setPage] = useState(1);
  const [allBookings, setAllBookings] = useState<TBooking[]>([]);
  const { data, isLoading, error } = useBookingsPage({ page, limit: BOOKINGS_PAGE_LIMIT });
  const [cancelBookingTarget, setCancelBookingTarget] = useState<TBooking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const isPreview = isPreviewRoute(pathname);
  const hasMore = data.page < data.totalPages;
  const bookings = allBookings;

  useEffect(() => {
    if (page === 1) {
      setAllBookings(data.bookings);
      return;
    }

    setAllBookings((prev) => {
      const nextByID = new Map(data.bookings.map((booking) => [booking.id, booking]));
      const merged = prev.map((booking) => nextByID.get(booking.id) ?? booking);
      const seen = new Set(merged.map((booking) => booking.id));
      const appended = data.bookings.filter((booking) => !seen.has(booking.id));
      return appended.length === 0 ? merged : [...merged, ...appended];
    });
  }, [data.bookings, page]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  /***************************************************************************************************
   * Defines the active bookings value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  /***************************************************************************************************
   * Build the active list with shadow bookings superseding their originals. When an admin
   * proposes a reschedule, a reschedule_pending shadow is created that points at the original
   * via `replacesBookingId`. Showing both as siblings confuses the client — render only the
   * shadow (with old→new time visible on the card).
   ***************************************************************************************************/
  const activeBookings = useMemo(() => {
    const activeAll = bookings.filter(
      (b) => ACTIVE_STATUSES.has(b.status) && !isPastBooking(b, now),
    );
    const replacedIds = new Set<string>(
      activeAll
        .filter((b) => b.status === 'reschedule_pending' && b.replacesBookingId)
        .map((b) => b.replacesBookingId as string),
    );
    return activeAll
      .filter((b) => !replacedIds.has(b.id))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [bookings, now]);

  const replacedBookingLookup = useMemo(() => {
    const map = new Map<string, TBooking>();
    for (const b of bookings) {
      map.set(b.id, b);
    }
    return map;
  }, [bookings]);
  /***************************************************************************************************
   * Defines the past bookings value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const pastBookings = useMemo(
    () =>
      bookings
        .filter((b) => isPastBooking(b, now))
        .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()),
    [bookings, now],
  );

  /***************************************************************************************************
   * Handles cancel booking.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleCancelBooking = useCallback(async (): Promise<void> => {
    if (!cancelBookingTarget) {
      return;
    }

    const bookingId = cancelBookingTarget.id;
    const reason = cancelReason || t('cancelDefaultReason');

    try {
      await api.cancelBooking(bookingId, reason);
      setAllBookings((currentBookings) =>
        currentBookings.map((booking) =>
          booking.id === bookingId
            ? { ...booking, status: 'cancelled', cancelReason: reason }
            : booking,
        ),
      );
      toast.success(ts('bookingCancelled'));
      setCancelBookingTarget(null);
      setCancelReason('');
      invalidateBookings();
    } catch {
      toast.error(te('bookingCancelFailed'));
    }
  }, [cancelBookingTarget, cancelReason, t, te, ts]);

  /***************************************************************************************************
   * Handles confirm.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleConfirm = useCallback(
    async (booking: TBooking): Promise<void> => {
      try {
        await api.confirmBooking(booking.id);
        toast.success(ts('bookingConfirmed'));
        invalidateBookings();
      } catch {
        toast.error(te('bookingConfirmFailed'));
      }
    },
    [te, ts],
  );

  /***************************************************************************************************
   * Handles decline.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleDecline = useCallback(
    async (booking: TBooking): Promise<void> => {
      try {
        await api.declineBooking(booking.id);
        toast.success(ts('bookingDeclined'));
        invalidateBookings();
      } catch {
        toast.error(te('bookingDeclineFailed'));
      }
    },
    [te, ts],
  );

  const reschedule = useRescheduleActions();

  if (isLoading && bookings.length === 0) {
    return (
      <div className={'space-y-4 p-4'}>
        <h2 className={'px-1 text-lg font-semibold'}>{t('title')}</h2>
        <div className={'bg-card mb-3 h-4 w-28 animate-pulse rounded'} />
        <div className={'space-y-3'}>
          <BookingCardSkeleton />
          <BookingCardSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={'space-y-4 p-4'}>
        <h2 className={'px-1 text-lg font-semibold'}>{t('title')}</h2>
        <EmptyState
          icon={<CalendarX className={'h-16 w-16'} />}
          title={t('loadError')}
          description={t('loadErrorDescription')}
        />
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className={'space-y-4 p-4'}>
        <h2 className={'px-1 text-lg font-semibold'}>{t('title')}</h2>
        <EmptyState
          icon={<CalendarX className={'h-16 w-16'} />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      </div>
    );
  }

  return (
    <div>
      <div className={'space-y-4 p-4'}>
        <h2 className={'px-1 text-lg font-semibold'}>{t('title')}</h2>

        {activeBookings.length > 0 && (
          <div>
            <h3 className={'text-muted-foreground mb-3 text-sm font-medium'}>
              {t('activeBookings')}
            </h3>
            <div className={'space-y-3'}>
              {activeBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onCancel={isPreview ? undefined : setCancelBookingTarget}
                  onConfirm={
                    !isPreview && booking.status === 'pending' && booking.createdBy === 'specialist'
                      ? handleConfirm
                      : undefined
                  }
                  onDecline={
                    !isPreview && booking.status === 'pending' && booking.createdBy === 'specialist'
                      ? handleDecline
                      : undefined
                  }
                  onApproveReschedule={
                    !isPreview && booking.status === 'reschedule_pending'
                      ? reschedule.approve
                      : undefined
                  }
                  onDeclineReschedule={
                    !isPreview && booking.status === 'reschedule_pending'
                      ? reschedule.decline
                      : undefined
                  }
                  replacedBooking={
                    booking.status === 'reschedule_pending' && booking.replacesBookingId
                      ? replacedBookingLookup.get(booking.replacesBookingId)
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
              className={'text-muted-foreground mb-3 flex items-center gap-2 text-sm font-medium'}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showPast ? 'rotate-0' : '-rotate-90'}`}
              />
              {t('pastBookings')}
              {' ('}
              {pastBookings.length}
              {')'}
            </button>
            {showPast && (
              <div className={'space-y-3'}>
                {pastBookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
                {hasMore && (
                  <button
                    type={'button'}
                    onClick={() => setPage((current) => current + 1)}
                    disabled={isLoading}
                    className={
                      'bg-card text-brand w-full rounded-xl py-3 text-center text-sm font-medium active:opacity-80 disabled:opacity-50'
                    }
                  >
                    {isLoading ? t('loading') : t('loadMore')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {!isPreview && (
        <ConfirmDialog
          isOpen={!!cancelBookingTarget}
          onClose={() => {
            setCancelBookingTarget(null);
            setCancelReason('');
          }}
          onConfirm={handleCancelBooking}
          title={t('cancelDialog')}
          description={t('cancelConfirmMessage')}
          confirmText={tc('yes')}
          cancelText={tc('no')}
          destructive
          showInput
          inputPlaceholder={t('cancelReasonPlaceholder')}
          inputValue={cancelReason}
          onInputChange={setCancelReason}
        />
      )}
    </div>
  );
}
