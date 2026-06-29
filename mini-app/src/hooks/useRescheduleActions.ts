'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { invalidateBookings, invalidateRecurring } from '@/hooks/mutations';
import { api } from '@/lib/api';

import type { TBooking } from '@/lib/types';

/***************************************************************************************************
 * Shared hook for approve / decline of a reschedule_pending booking.
 *
 * Used by the client home booking modal, /bookings BookingCard, admin dashboard, and the
 * admin bookings list. Mode='client' calls the client API endpoints; mode='admin' calls the
 * admin API endpoints. Both invalidate the shared SWR bookings cache.
 *
 * Parameters:
 * - mode: 'client' (default) or 'admin'. Determines which API endpoints are used.
 ***************************************************************************************************/
export function useRescheduleActions(mode: 'client' | 'admin' = 'client'): {
  pending: boolean;
  approve: (booking: TBooking) => Promise<void>;
  decline: (booking: TBooking) => Promise<void>;
} {
  const ts = useTranslations('Success');
  const te = useTranslations('Errors');
  const [pending, setPending] = useState(false);

  const approve = useCallback(
    async (booking: TBooking): Promise<void> => {
      setPending(true);
      try {
        if (mode === 'admin') {
          await api.admin.approveReschedule(booking.id);
        } else {
          await api.approveReschedule(booking.id);
        }
        toast.success(ts('bookingRescheduled'));
        await invalidateBookings();
        if (booking.recurringScheduleId) {
          await invalidateRecurring();
        }
      } catch {
        toast.error(te('bookingRescheduleFailed'));
        await invalidateBookings();
        if (booking.recurringScheduleId) {
          await invalidateRecurring();
        }
      } finally {
        setPending(false);
      }
    },
    [mode, ts, te],
  );

  const decline = useCallback(
    async (booking: TBooking): Promise<void> => {
      setPending(true);
      try {
        if (mode === 'admin') {
          await api.admin.declineReschedule(booking.id);
        } else {
          await api.declineReschedule(booking.id);
        }
        await invalidateBookings();
        if (booking.recurringScheduleId) {
          await invalidateRecurring();
        }
      } catch {
        toast.error(te('bookingDeclineFailed'));
        await invalidateBookings();
        if (booking.recurringScheduleId) {
          await invalidateRecurring();
        }
      } finally {
        setPending(false);
      }
    },
    [mode, te],
  );

  return { pending, approve, decline };
}
