'use client';

import { CalendarX, ChevronDown } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { BookingCard } from '@/components/BookingCard';
import { ClientBookingsPageWatcher } from '@/components/BookingsPageWatchers';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { BookingCardSkeleton } from '@/components/LoadingSkeleton';
import { reportBookingActionFailure } from '@/hooks/booking-action-error';
import { invalidateBookings } from '@/hooks/mutations';
import { useBookingsPage, useSpecialist } from '@/hooks/queries';
import { useRescheduleActions } from '@/hooks/useRescheduleActions';
import { api } from '@/lib/api';
import { collapseReschedulePending, isWithinCutoff, wallClockNow } from '@/lib/helpers';
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
  const { data: specialist } = useSpecialist();
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState<Record<number, TBooking[]>>({});
  const { data, isLoading, error } = useBookingsPage({ page, limit: BOOKINGS_PAGE_LIMIT });
  const [cancelBookingTarget, setCancelBookingTarget] = useState<TBooking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [now, setNow] = useState(() => wallClockNow());
  const isPreview = isPreviewRoute(pathname);
  const hasMore = data.page < data.totalPages;

  const handlePageData = useCallback((pageNumber: number, list: TBooking[]): void => {
    setPages((prev) => (prev[pageNumber] === list ? prev : { ...prev, [pageNumber]: list }));
  }, []);

  /***************************************************************************************************
   * The current page is reported here; earlier pages stay mounted through ClientBookingsPageWatcher,
   * so every loaded page is revalidated by the `bookings` change group (e.g. when a booking is
   * confirmed or declined from the Telegram bot).
   ***************************************************************************************************/
  useEffect(() => {
    if (!isLoading && !error) {
      handlePageData(page, data.bookings);
    }
  }, [data.bookings, error, handlePageData, isLoading, page]);

  const bookings = useMemo(() => {
    const seen = new Set<string>();
    const merged: TBooking[] = [];
    const pageNumbers = Object.keys(pages)
      .map(Number)
      .filter((pageNumber) => pageNumber <= page)
      .sort((left, right) => left - right);
    for (const pageNumber of pageNumbers) {
      for (const booking of pages[pageNumber]) {
        if (!seen.has(booking.id)) {
          seen.add(booking.id);
          merged.push(booking);
        }
      }
    }
    return merged;
  }, [page, pages]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(wallClockNow()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  /***************************************************************************************************
   * Build the active list with shadow bookings superseding their originals. Uses the shared
   * collapseReschedulePending helper which hides originals that have a pending shadow and
   * returns a lookup map for old→new time display.
   ***************************************************************************************************/
  const { activeBookings, replacedBookingLookup } = useMemo(() => {
    const activeIds = new Set(
      bookings
        .filter((b) => ACTIVE_STATUSES.has(b.status) && !isPastBooking(b, now))
        .map((b) => b.id),
    );
    // Build replacedLookup from the FULL bookings list so that originals whose
    // startsAt is already in the past are still found and the "was <old time>"
    // annotation renders correctly on reschedule_pending shadow cards.
    const { visible: visibleFromFull, replacedLookup } = collapseReschedulePending(bookings);
    const visible = visibleFromFull.filter((b) => activeIds.has(b.id));
    return {
      activeBookings: visible.sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      ),
      replacedBookingLookup: replacedLookup,
    };
  }, [bookings, now]);
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
      toast.success(ts('bookingCancelled'));
      setCancelBookingTarget(null);
      setCancelReason('');
      await invalidateBookings();
    } catch (err) {
      setCancelBookingTarget(null);
      setCancelReason('');
      await reportBookingActionFailure(err, {
        fallback: te('bookingCancelFailed'),
        stale: te('bookingAlreadyProcessed'),
      });
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
        await invalidateBookings();
      } catch (err) {
        await reportBookingActionFailure(
          err,
          { fallback: te('bookingConfirmFailed'), stale: te('bookingAlreadyProcessed') },
          { includeBadRequest: true },
        );
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
        await invalidateBookings();
      } catch (err) {
        await reportBookingActionFailure(
          err,
          { fallback: te('bookingDeclineFailed'), stale: te('bookingAlreadyProcessed') },
          { includeBadRequest: true },
        );
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
      {Array.from({ length: Math.max(page - 1, 0) }, (_, index) => (
        <ClientBookingsPageWatcher
          key={index + 1}
          page={index + 1}
          limit={BOOKINGS_PAGE_LIMIT}
          onData={handlePageData}
        />
      ))}
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
                    !isPreview &&
                    booking.status === 'reschedule_pending' &&
                    booking.createdBy === 'specialist'
                      ? reschedule.approve
                      : undefined
                  }
                  onDeclineReschedule={
                    !isPreview &&
                    booking.status === 'reschedule_pending' &&
                    booking.createdBy === 'specialist'
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
              </div>
            )}
          </div>
        )}
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

      {!isPreview && (
        <ConfirmDialog
          isOpen={!!cancelBookingTarget}
          onClose={() => {
            setCancelBookingTarget(null);
            setCancelReason('');
          }}
          onConfirm={handleCancelBooking}
          title={t('cancelDialog')}
          description={
            cancelBookingTarget && isWithinCutoff(cancelBookingTarget, specialist)
              ? `${t('cancelConfirmMessage')} ${t('lateCancelWarning')}`
              : t('cancelConfirmMessage')
          }
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
