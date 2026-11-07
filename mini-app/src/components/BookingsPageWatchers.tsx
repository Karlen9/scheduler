'use client';

import { useEffect } from 'react';

import { useAdminBookingsPage, useBookingsPage } from '@/hooks/queries';

import type { TAdminBookingsQuery, TBooking } from '@/lib/types';

/***************************************************************************************************
 * Headless watchers that keep every already-loaded page of a paginated bookings list mounted.
 *
 * Paginated lists accumulate earlier pages in local state; without a mounted SWR hook per page,
 * only the page currently being fetched would be revalidated by the `bookings` change group, so
 * statuses changed elsewhere (e.g. accepted in the Telegram bot) would stay stale on the earlier
 * pages. Each watcher subscribes to one page and reports its data to the owning list.
 ***************************************************************************************************/
export function AdminBookingsPageWatcher({
  query,
  onData,
}: {
  query: TAdminBookingsQuery;
  onData: (page: number, bookings: TBooking[]) => void;
}): null {
  const { data, isLoading, error } = useAdminBookingsPage(query);

  useEffect(() => {
    if (!isLoading && !error) {
      onData(query.page, data.bookings);
    }
  }, [data.bookings, error, isLoading, onData, query.page]);

  return null;
}

/***************************************************************************************************
 * Client-side counterpart of AdminBookingsPageWatcher.
 ***************************************************************************************************/
export function ClientBookingsPageWatcher({
  page,
  limit,
  onData,
}: {
  page: number;
  limit: number;
  onData: (page: number, bookings: TBooking[]) => void;
}): null {
  const { data, isLoading, error } = useBookingsPage({ page, limit });

  useEffect(() => {
    if (!isLoading && !error) {
      onData(page, data.bookings);
    }
  }, [data.bookings, error, isLoading, onData, page]);

  return null;
}
