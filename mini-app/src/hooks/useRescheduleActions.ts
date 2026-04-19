'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { invalidateBookings, invalidateRecurring } from '@/hooks/mutations';
import { api } from '@/lib/api';

import type { TBooking } from '@/lib/types';

/***************************************************************************************************
 * Shared hook for client-side approve / decline of a reschedule_pending booking.
 *
 * Used by the client home booking modal, /bookings BookingCard, and the recurring schedule
 * detail page. Centralises the API + toast + cache-invalidation logic so the three surfaces
 * stay in sync (previously only BookingCard had it, leaving the home modal dead-ended).
 ***************************************************************************************************/
export function useRescheduleActions(): {
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
        await api.approveReschedule(booking.id);
        toast.success(ts('bookingRescheduled'));
        await invalidateBookings();
        if (booking.recurringScheduleId) {
          await invalidateRecurring();
        }
      } catch {
        toast.error(te('bookingRescheduleFailed'));
      } finally {
        setPending(false);
      }
    },
    [ts, te],
  );

  const decline = useCallback(
    async (booking: TBooking): Promise<void> => {
      setPending(true);
      try {
        await api.declineReschedule(booking.id);
        await invalidateBookings();
        if (booking.recurringScheduleId) {
          await invalidateRecurring();
        }
      } catch {
        toast.error(te('bookingDeclineFailed'));
      } finally {
        setPending(false);
      }
    },
    [te],
  );

  return { pending, approve, decline };
}
