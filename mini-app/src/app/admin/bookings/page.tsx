'use client';

import { CalendarX, ChevronRight, Filter, ListChecks } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { BookingDetailModal } from '@/components/BookingDetailModal';
import { BottomSheet } from '@/components/BottomSheet';
import { ClientAvatar } from '@/components/ClientAvatar';
import { EmptyState } from '@/components/EmptyState';
import { RescheduleSheet } from '@/components/RescheduleSheet';
import { StatusBadge } from '@/components/StatusBadge';
import { TopBar } from '@/components/TopBar';
import { invalidateBookings } from '@/hooks/mutations';
import { useAdminBookingsPage, useAdminServices, useClients } from '@/hooks/queries';
import {
  ADMIN_BOOKING_STATUS_OPTIONS,
  ADMIN_UPCOMING_BOOKING_STATUSES,
  todayISO,
  yesterdayISO,
} from '@/lib/admin-bookings';
import { api } from '@/lib/api';
import { clientEntityLabel } from '@/lib/helpers';
import { resolveTestAwareHref } from '@/lib/routes';
import { openTelegramUserChat } from '@/lib/telegram';

import { CancelDialog } from '../CancelDialog';
import { RejectDialog } from '../RejectDialog';

import type { TAdminBookingsQuery, TAdminBookingsSort, TBooking, TClientInfo } from '@/lib/types';
import type { ReactNode } from 'react';

const PAGE_LIMIT = 20;

type TBookingsTab = 'upcoming' | 'history';

const sortOptions: TAdminBookingsSort[] = [
  'created_desc',
  'starts_at_asc',
  'starts_at_desc',
  'status_asc',
];

type TBookingPageFilters = {
  tab: TBookingsTab;
  statuses: TBooking['status'][];
  dateFrom: string;
  dateTo: string;
  clientId: string;
  serviceIds: string[];
  sort: TAdminBookingsSort | '';
};

const defaultFilters: TBookingPageFilters = {
  tab: 'upcoming',
  statuses: [],
  dateFrom: '',
  dateTo: '',
  clientId: '',
  serviceIds: [],
  sort: '',
};

function tabDefaultSort(tab: TBookingsTab): TAdminBookingsSort {
  return tab === 'history' ? 'starts_at_desc' : 'starts_at_asc';
}

function parseFiltersFromParams(params: URLSearchParams): TBookingPageFilters {
  const rawStatuses = params.get('statuses')?.split(',').filter(Boolean) ?? [];
  const statuses = rawStatuses.filter((s): s is TBooking['status'] =>
    (ADMIN_BOOKING_STATUS_OPTIONS as string[]).includes(s),
  );
  const sortParam = params.get('sort');
  const sort =
    sortParam && (sortOptions as string[]).includes(sortParam)
      ? (sortParam as TAdminBookingsSort)
      : '';
  const tabParam = params.get('tab');
  const tab: TBookingsTab = tabParam === 'history' ? 'history' : 'upcoming';
  return {
    tab,
    statuses,
    dateFrom: params.get('dateFrom') ?? '',
    dateTo: params.get('dateTo') ?? '',
    clientId: params.get('clientId') ?? '',
    serviceIds: params.get('services')?.split(',').filter(Boolean) ?? [],
    sort,
  };
}

function serializeFiltersToParams(f: TBookingPageFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (f.tab !== 'upcoming') {
    params.set('tab', f.tab);
  }
  if (f.statuses.length > 0) {
    params.set('statuses', f.statuses.join(','));
  }
  if (f.dateFrom) {
    params.set('dateFrom', f.dateFrom);
  }
  if (f.dateTo) {
    params.set('dateTo', f.dateTo);
  }
  if (f.clientId) {
    params.set('clientId', f.clientId);
  }
  if (f.serviceIds.length > 0) {
    params.set('services', f.serviceIds.join(','));
  }
  if (f.sort) {
    params.set('sort', f.sort);
  }
  return params;
}

const statusTranslationKeys: Record<TBooking['status'], string> = {
  pending: 'pending',
  confirmed: 'confirmed',
  rejected: 'rejected',
  cancelled: 'cancelled',
  completed: 'completed',
  cancel_requested: 'cancelRequested',
  reschedule_pending: 'reschedulePending',
};

function bookingDisplayName(booking: TBooking): string {
  return booking.clientDisplayName || booking.clientName;
}

function clientBaseName(client: TClientInfo): string {
  return client.displayName || client.name;
}

export default function AdminAllBookingsPage(): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations('AdminAllBookings');
  const tc = useTranslations('Common');
  const te = useTranslations('Errors');
  const ts = useTranslations('Success');
  const tst = useTranslations('Status');

  /***************************************************************************************************
   * URL is the source of truth for committed filters. Deriving on each render makes refresh,
   * shared links, and browser back/forward work without any state-sync plumbing. Parsing is
   * cheap (small number of params) so recomputing per render is fine.
   ***************************************************************************************************/
  const searchParamsString = searchParams.toString();
  const filters = useMemo(
    () => parseFiltersFromParams(new URLSearchParams(searchParamsString)),
    [searchParamsString],
  );

  const [page, setPage] = useState(1);
  const [allBookings, setAllBookings] = useState<TBooking[]>([]);
  const [draftFilters, setDraftFilters] = useState<TBookingPageFilters>(filters);
  const prevPageRef = useRef(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<TBooking | null>(null);
  const [rescheduleBooking, setRescheduleBooking] = useState<TBooking | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<TBooking | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [clientFilterSearch, setClientFilterSearch] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);
  const [dateInputResetKey, setDateInputResetKey] = useState(0);

  const query = useMemo<TAdminBookingsQuery>(() => {
    /***************************************************************************************************
     * The selected tab clamps the date range and supplies a default status set so cancelled or
     * past bookings can't leak into "Upcoming" and future rows can't leak into "History".
     ***************************************************************************************************/
    const today = todayISO();
    const yesterday = yesterdayISO();

    let effectiveDateFrom = filters.dateFrom;
    let effectiveDateTo = filters.dateTo;
    let effectiveStatuses = filters.statuses;

    if (filters.tab === 'upcoming') {
      effectiveDateFrom = filters.dateFrom && filters.dateFrom > today ? filters.dateFrom : today;
      if (effectiveStatuses.length === 0) {
        effectiveStatuses = ADMIN_UPCOMING_BOOKING_STATUSES;
      } else {
        effectiveStatuses = effectiveStatuses.filter((s) =>
          ADMIN_UPCOMING_BOOKING_STATUSES.includes(s),
        );
        if (effectiveStatuses.length === 0) {
          effectiveStatuses = ADMIN_UPCOMING_BOOKING_STATUSES;
        }
      }
    } else {
      effectiveDateTo = filters.dateTo && filters.dateTo < yesterday ? filters.dateTo : yesterday;
    }

    return {
      page,
      limit: PAGE_LIMIT,
      statuses: effectiveStatuses,
      dateFrom: effectiveDateFrom,
      dateTo: effectiveDateTo,
      clientId: filters.clientId,
      serviceIds: filters.serviceIds,
      sort: filters.sort || tabDefaultSort(filters.tab),
    };
  }, [filters, page]);

  const { data, isLoading, error, mutate } = useAdminBookingsPage(query);
  const { data: services } = useAdminServices();
  const { data: clients } = useClients();

  /***************************************************************************************************
   * Sync the client-search display label with the committed clientId filter. Typing in the
   * search box mutates draftFilters.clientId (not filters), so this effect won't clobber
   * the user's in-progress text; it only runs when the committed filter actually changes.
   ***************************************************************************************************/
  useEffect(() => {
    if (!filters.clientId) {
      setClientFilterSearch('');
      return;
    }
    if (clients.length === 0) {
      return;
    }
    const matched = clients.find((c) => c.id === filters.clientId);
    if (!matched) {
      return;
    }
    setClientFilterSearch(
      `${clientBaseName(matched)}${matched.phone ? `, ${matched.phone}` : ''}${matched.isGhost ? ` ${tc('ghost')}` : ''}`,
    );
  }, [filters.clientId, clients, tc]);

  /***************************************************************************************************
   * Reset pagination whenever the URL-driven filters change (via apply, reset, or back/forward).
   ***************************************************************************************************/
  useEffect(() => {
    setPage(1);
    setAllBookings([]);
    prevPageRef.current = 1;
  }, [searchParamsString]);

  const writeFiltersToUrl = useCallback(
    (next: TBookingPageFilters): void => {
      const nextQuery = serializeFiltersToParams(next).toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  useEffect(() => {
    if (data.bookings.length === 0) {
      if (page === 1) {
        setAllBookings([]);
      }
      return;
    }
    if (page === 1) {
      setAllBookings(data.bookings);
    } else if (page !== prevPageRef.current) {
      setAllBookings((prev) => [...prev, ...data.bookings]);
    }
    prevPageRef.current = page;
  }, [data.bookings, page]);

  const hasMore = data.totalPages > 0 && page < data.totalPages;

  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      setPage((p) => p + 1);
    }
  }, [hasMore, isLoading]);

  const activeFiltersCount = [
    filters.statuses.length > 0,
    filters.dateFrom,
    filters.dateTo,
    filters.clientId,
    filters.serviceIds.length > 0,
  ].filter(Boolean).length;

  const filteredClients = useMemo(() => {
    const search = clientFilterSearch.trim().toLowerCase();
    if (!search) {
      return clients;
    }

    return clients.filter((client) =>
      [client.name, client.displayName ?? '', client.phone ?? '']
        .join(' ')
        .toLowerCase()
        .includes(search),
    );
  }, [clientFilterSearch, clients]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      }),
    [locale],
  );

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      }),
    [locale],
  );

  const formatDate = (iso: string): string => dateFormatter.format(new Date(iso));
  const formatTime = (iso: string): string => timeFormatter.format(new Date(iso));
  const formatTimeRange = (booking: TBooking): string =>
    `${formatTime(booking.startsAt)} - ${formatTime(booking.endsAt)}`;

  const formatClientFilterLabel = (client: TClientInfo): string =>
    `${clientBaseName(client)}${client.phone ? `, ${client.phone}` : ''}${
      client.isGhost ? ` ${tc('ghost')}` : ''
    }`;

  const statusFilterLabel =
    draftFilters.statuses.length === 0
      ? t('allStatuses')
      : draftFilters.statuses.map((status) => tst(statusTranslationKeys[status])).join(', ');

  const serviceFilterLabel =
    draftFilters.serviceIds.length === 0
      ? t('allServices')
      : services
          .filter((service) => draftFilters.serviceIds.includes(service.id))
          .map((service) => service.name)
          .join(', ');

  const toggleFilterValue = <T extends string>(values: T[], selected: T): T[] =>
    values.includes(selected)
      ? values.filter((value) => value !== selected)
      : [...values, selected];

  const applyFilters = (): void => {
    writeFiltersToUrl(draftFilters);
    setClientDropdownOpen(false);
    setStatusDropdownOpen(false);
    setServiceDropdownOpen(false);
    setShowFilters(false);
  };

  const resetFilters = (): void => {
    const nextFilters: TBookingPageFilters = { ...defaultFilters, tab: filters.tab };
    setDraftFilters(nextFilters);
    writeFiltersToUrl(nextFilters);
    setClientFilterSearch('');
    setClientDropdownOpen(false);
    setStatusDropdownOpen(false);
    setServiceDropdownOpen(false);
    setDateInputResetKey((value) => value + 1);
    setShowFilters(false);
  };

  const handleAccept = async (booking: TBooking): Promise<void> => {
    try {
      await api.admin.updateBookingStatus(booking.id, 'confirmed');
      toast.success(ts('bookingConfirmed'));
      setSelectedBooking(null);
      await mutate();
      await invalidateBookings();
    } catch {
      toast.error(te('bookingConfirmFailed'));
    }
  };

  const handleRejectClick = (booking: TBooking): void => {
    setSelectedBooking(null);
    setRejectTarget(booking);
    setShowRejectDialog(true);
  };

  const handleConfirmReject = async (): Promise<void> => {
    if (!rejectTarget) {
      return;
    }
    try {
      await api.admin.updateBookingStatus(rejectTarget.id, 'rejected', rejectReason || undefined);
      toast.success(ts('bookingRejected'));
      await mutate();
      await invalidateBookings();
    } catch {
      toast.error(te('bookingRejectFailed'));
    }
    setShowRejectDialog(false);
    setRejectTarget(null);
    setRejectReason('');
  };

  const handleCancelClick = (booking: TBooking): void => {
    setSelectedBooking(booking);
    setShowCancelDialog(true);
  };

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
      await mutate();
      await invalidateBookings();
    } catch {
      toast.error(te('bookingCancelFailed'));
    }
    setShowCancelDialog(false);
    setSelectedBooking(null);
    setCancelReason('');
  };

  const handleRescheduleClick = (booking: TBooking): void => {
    setSelectedBooking(null);
    setRescheduleBooking(booking);
  };

  const handleMessageClient = (booking: TBooking): void => {
    if (
      booking.clientIsGhost ||
      booking.clientIsSelf ||
      !openTelegramUserChat(booking.clientTelegramUsername)
    ) {
      toast.error(t('dmUnavailable'));
    }
  };

  return (
    <div>
      <TopBar
        title={t('title')}
        showBack
        onBack={() => router.push(resolveTestAwareHref(pathname, '/admin'))}
      />

      <div className={'space-y-4 p-4'}>
        <div role={'tablist'} className={'bg-card flex items-center gap-1 rounded-lg p-1'}>
          {(['upcoming', 'history'] as TBookingsTab[]).map((tab) => {
            const isActive = filters.tab === tab;
            return (
              <button
                key={tab}
                type={'button'}
                role={'tab'}
                aria-selected={isActive}
                onClick={() => {
                  if (filters.tab === tab) {
                    return;
                  }
                  writeFiltersToUrl({ ...filters, tab, sort: '' });
                }}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors active:opacity-80 ${
                  isActive ? 'bg-background text-foreground' : 'text-muted-foreground'
                }`}
              >
                {t(`tabs.${tab}`)}
              </button>
            );
          })}
        </div>

        <div className={'flex items-center justify-between gap-3'}>
          <div className={'min-w-0'}>
            <p className={'text-muted-foreground text-sm'}>
              {t('totalCount', { count: data.total })}
            </p>
          </div>
          <button
            type={'button'}
            onClick={() => {
              setDraftFilters(filters);
              const selectedClient = clients.find((client) => client.id === filters.clientId);
              setClientFilterSearch(selectedClient ? formatClientFilterLabel(selectedClient) : '');
              setClientDropdownOpen(false);
              setStatusDropdownOpen(false);
              setServiceDropdownOpen(false);
              setShowFilters(true);
            }}
            className={
              'bg-card text-foreground flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium active:opacity-80'
            }
          >
            <Filter className={'h-4 w-4'} />
            {activeFiltersCount > 0
              ? t('filtersWithCount', { count: activeFiltersCount })
              : t('filters')}
          </button>
        </div>

        {error && (
          <div className={'bg-action-danger-bg text-action-danger-text rounded-lg p-4 text-center'}>
            {error instanceof Error ? error.message : te('loadBookingsFailed')}
          </div>
        )}

        {isLoading && allBookings.length === 0 ? (
          <div className={'space-y-3'}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className={'bg-card flex animate-pulse items-center gap-3 rounded-xl p-4'}
              >
                <div className={'bg-skeleton h-10 w-10 rounded-full'} />
                <div className={'min-w-0 flex-1 space-y-2'}>
                  <div className={'bg-skeleton h-4 w-1/2 rounded'} />
                  <div className={'bg-skeleton h-3 w-2/3 rounded'} />
                </div>
              </div>
            ))}
          </div>
        ) : allBookings.length === 0 ? (
          <div className={'flex min-h-[320px] items-center justify-center'}>
            <EmptyState
              icon={
                activeFiltersCount > 0 ? (
                  <CalendarX className={'h-16 w-16'} />
                ) : (
                  <ListChecks className={'h-16 w-16'} />
                )
              }
              title={activeFiltersCount > 0 ? t('emptyFilteredTitle') : t('emptyTitle')}
              description={
                activeFiltersCount > 0 ? t('emptyFilteredDescription') : t('emptyDescription')
              }
            />
          </div>
        ) : (
          <div className={'space-y-3'}>
            {allBookings.map((booking) => (
              <button
                key={booking.id}
                type={'button'}
                onClick={() => setSelectedBooking(booking)}
                className={
                  'bg-card flex w-full items-center gap-3 rounded-xl p-4 text-left active:opacity-80'
                }
              >
                <ClientAvatar
                  name={bookingDisplayName(booking)}
                  photoUrl={booking.clientPhotoUrl}
                  size={'md'}
                  isSelf={booking.clientIsSelf}
                />
                <div className={'min-w-0 flex-1'}>
                  <div className={'mb-1 flex items-center gap-2'}>
                    <span className={'text-foreground truncate font-medium'}>
                      {clientEntityLabel(booking, tc('self'))}
                    </span>
                    {booking.clientIsGhost && (
                      <span className={'text-muted-foreground shrink-0 text-xs'}>
                        {tc('ghost')}
                      </span>
                    )}
                  </div>
                  <div className={'text-muted-foreground text-sm'}>
                    {formatDate(booking.startsAt)} {formatTimeRange(booking)}
                  </div>
                  <div className={'mt-2 flex items-center justify-between gap-2'}>
                    <span className={'text-muted-foreground min-w-0 truncate text-xs'}>
                      {booking.sessionType?.name || tc('workout')}
                    </span>
                    <StatusBadge status={booking.status} className={'shrink-0 px-2 py-0.5'} />
                  </div>
                </div>
                <ChevronRight className={'text-muted-foreground h-5 w-5 shrink-0'} />
              </button>
            ))}

            {hasMore && (
              <button
                type={'button'}
                onClick={loadMore}
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

      <BottomSheet
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        title={t('filtersTitle')}
        className={'max-h-[85vh] overflow-y-auto'}
      >
        <div className={'space-y-4 pb-8'}>
          <fieldset className={'space-y-2'}>
            <legend className={'text-muted-foreground text-sm'}>{t('clientSearch')}</legend>
            <div className={'relative'}>
              <input
                value={clientFilterSearch}
                onFocus={() => {
                  setClientDropdownOpen(true);
                  setStatusDropdownOpen(false);
                  setServiceDropdownOpen(false);
                }}
                onBlur={() => setClientDropdownOpen(false)}
                onChange={(event) => {
                  setClientFilterSearch(event.target.value);
                  setClientDropdownOpen(true);
                  setDraftFilters((value) => ({ ...value, clientId: '' }));
                }}
                placeholder={t('clientSearchPlaceholder')}
                role={'combobox'}
                aria-expanded={clientDropdownOpen}
                className={
                  'border-border bg-background text-foreground focus:border-brand w-full rounded-lg border px-3 py-2 text-sm outline-none'
                }
              />
              {clientDropdownOpen && (
                <div
                  className={
                    'border-border bg-background absolute top-full left-0 z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border py-1 shadow-lg'
                  }
                >
                  <button
                    type={'button'}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setDraftFilters((value) => ({ ...value, clientId: '' }));
                      setClientFilterSearch('');
                      setClientDropdownOpen(false);
                    }}
                    className={
                      'text-foreground w-full px-3 py-2 text-left text-sm active:opacity-80'
                    }
                  >
                    {t('allClients')}
                  </button>
                  {filteredClients.length === 0 ? (
                    <div className={'text-muted-foreground px-3 py-2 text-sm'}>
                      {t('noClientsFound')}
                    </div>
                  ) : (
                    filteredClients.map((client) => (
                      <button
                        key={client.id}
                        type={'button'}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setDraftFilters((value) => ({ ...value, clientId: client.id }));
                          setClientFilterSearch(formatClientFilterLabel(client));
                          setClientDropdownOpen(false);
                        }}
                        className={
                          'text-foreground w-full px-3 py-2 text-left text-sm active:opacity-80'
                        }
                      >
                        <span className={'block truncate'}>
                          {clientBaseName(client)}
                          {client.isGhost ? ` ${tc('ghost')}` : ''}
                        </span>
                        {client.phone && (
                          <span className={'text-muted-foreground block truncate text-xs'}>
                            {client.phone}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </fieldset>

          <fieldset className={'space-y-2'}>
            <legend className={'text-muted-foreground text-sm'}>{t('status')}</legend>
            <div className={'relative'}>
              <button
                type={'button'}
                onClick={() => {
                  setStatusDropdownOpen((value) => !value);
                  setClientDropdownOpen(false);
                  setServiceDropdownOpen(false);
                }}
                className={
                  'border-border bg-background text-foreground focus:border-brand flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm outline-none'
                }
                aria-expanded={statusDropdownOpen}
              >
                <span className={'min-w-0 truncate text-left'}>{statusFilterLabel}</span>
                <ChevronRight
                  className={`text-muted-foreground h-4 w-4 shrink-0 transition-transform ${
                    statusDropdownOpen ? 'rotate-90' : ''
                  }`}
                />
              </button>
              {statusDropdownOpen && (
                <div
                  className={
                    'border-border bg-background absolute top-full left-0 z-20 mt-1 max-h-52 w-full space-y-2 overflow-y-auto rounded-lg border p-3 shadow-lg'
                  }
                >
                  <label className={'text-foreground flex items-center gap-3 text-sm'}>
                    <input
                      type={'checkbox'}
                      checked={draftFilters.statuses.length === 0}
                      onChange={() => setDraftFilters((value) => ({ ...value, statuses: [] }))}
                      className={'accent-brand h-4 w-4 shrink-0'}
                    />
                    <span className={'min-w-0 truncate'}>{t('allStatuses')}</span>
                  </label>
                  {(draftFilters.tab === 'upcoming'
                    ? ADMIN_UPCOMING_BOOKING_STATUSES
                    : ADMIN_BOOKING_STATUS_OPTIONS
                  ).map((status) => (
                    <label
                      key={status}
                      className={'text-foreground flex items-center gap-3 text-sm'}
                    >
                      <input
                        type={'checkbox'}
                        checked={draftFilters.statuses.includes(status)}
                        onChange={() =>
                          setDraftFilters((value) => ({
                            ...value,
                            statuses: toggleFilterValue(value.statuses, status),
                          }))
                        }
                        className={'accent-brand h-4 w-4 shrink-0'}
                      />
                      <span className={'min-w-0 truncate'}>
                        {tst(statusTranslationKeys[status])}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </fieldset>

          <div className={'min-w-0 space-y-3'}>
            <label className={'block min-w-0 space-y-1'}>
              <span className={'text-muted-foreground text-sm'}>{t('dateFrom')}</span>
              <input
                key={`from-${dateInputResetKey}`}
                type={'date'}
                value={draftFilters.dateFrom}
                onChange={(event) =>
                  setDraftFilters((value) => ({ ...value, dateFrom: event.target.value }))
                }
                className={
                  'border-border bg-background text-foreground focus:border-brand w-full max-w-full min-w-0 appearance-none rounded-lg border px-3 py-2 text-sm outline-none'
                }
              />
            </label>
            <label className={'block min-w-0 space-y-1'}>
              <span className={'text-muted-foreground text-sm'}>{t('dateTo')}</span>
              <input
                key={`to-${dateInputResetKey}`}
                type={'date'}
                value={draftFilters.dateTo}
                onChange={(event) =>
                  setDraftFilters((value) => ({ ...value, dateTo: event.target.value }))
                }
                className={
                  'border-border bg-background text-foreground focus:border-brand w-full max-w-full min-w-0 appearance-none rounded-lg border px-3 py-2 text-sm outline-none'
                }
              />
            </label>
          </div>

          <fieldset className={'space-y-2'}>
            <legend className={'text-muted-foreground text-sm'}>{t('service')}</legend>
            <div className={'relative'}>
              <button
                type={'button'}
                onClick={() => {
                  setServiceDropdownOpen((value) => !value);
                  setClientDropdownOpen(false);
                  setStatusDropdownOpen(false);
                }}
                className={
                  'border-border bg-background text-foreground focus:border-brand flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm outline-none'
                }
                aria-expanded={serviceDropdownOpen}
              >
                <span className={'min-w-0 truncate text-left'}>{serviceFilterLabel}</span>
                <ChevronRight
                  className={`text-muted-foreground h-4 w-4 shrink-0 transition-transform ${
                    serviceDropdownOpen ? 'rotate-90' : ''
                  }`}
                />
              </button>
              {serviceDropdownOpen && (
                <div
                  className={
                    'border-border bg-background absolute top-full left-0 z-20 mt-1 max-h-52 w-full space-y-2 overflow-y-auto rounded-lg border p-3 shadow-lg'
                  }
                >
                  <label className={'text-foreground flex items-center gap-3 text-sm'}>
                    <input
                      type={'checkbox'}
                      checked={draftFilters.serviceIds.length === 0}
                      onChange={() => setDraftFilters((value) => ({ ...value, serviceIds: [] }))}
                      className={'accent-brand h-4 w-4 shrink-0'}
                    />
                    <span className={'min-w-0 truncate'}>{t('allServices')}</span>
                  </label>
                  {services.map((service) => (
                    <label
                      key={service.id}
                      className={'text-foreground flex items-center gap-3 text-sm'}
                    >
                      <input
                        type={'checkbox'}
                        checked={draftFilters.serviceIds.includes(service.id)}
                        onChange={() =>
                          setDraftFilters((value) => ({
                            ...value,
                            serviceIds: toggleFilterValue(value.serviceIds, service.id),
                          }))
                        }
                        className={'accent-brand h-4 w-4 shrink-0'}
                      />
                      <span className={'min-w-0 truncate'}>{service.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </fieldset>

          <label className={'block space-y-1'}>
            <span className={'text-muted-foreground text-sm'}>{t('sort')}</span>
            <select
              value={draftFilters.sort || tabDefaultSort(draftFilters.tab)}
              onChange={(event) =>
                setDraftFilters((value) => ({
                  ...value,
                  sort: event.target.value as TAdminBookingsSort,
                }))
              }
              className={
                'border-border bg-background text-foreground focus:border-brand w-full rounded-lg border px-3 py-2 text-sm outline-none'
              }
            >
              {sortOptions.map((option) => (
                <option key={option} value={option}>
                  {t(`sortOptions.${option}`)}
                </option>
              ))}
            </select>
          </label>

          <div className={'flex gap-3 pt-2'}>
            <button
              type={'button'}
              onClick={(event) => {
                event.currentTarget.blur();
                resetFilters();
              }}
              className={
                'bg-background text-foreground flex-1 rounded-lg px-4 py-3 text-sm font-medium active:opacity-80'
              }
            >
              {t('resetFilters')}
            </button>
            <button
              type={'button'}
              onClick={applyFilters}
              className={
                'bg-brand flex-1 rounded-lg px-4 py-3 text-sm font-medium text-white active:opacity-80'
              }
            >
              {t('applyFilters')}
            </button>
          </div>
        </div>
      </BottomSheet>

      <BookingDetailModal
        booking={selectedBooking}
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onReschedule={handleRescheduleClick}
        onCancel={handleCancelClick}
        onAccept={handleAccept}
        onReject={handleRejectClick}
        onMessageClient={handleMessageClient}
      />

      <RescheduleSheet
        booking={rescheduleBooking}
        isOpen={!!rescheduleBooking}
        onClose={() => setRescheduleBooking(null)}
        onSuccess={() => {
          toast.success(ts('bookingRescheduled'));
          mutate();
          invalidateBookings();
        }}
      />

      <CancelDialog
        isOpen={showCancelDialog}
        targetName={selectedBooking ? bookingDisplayName(selectedBooking) : ''}
        reason={cancelReason}
        onReasonChange={setCancelReason}
        onConfirm={handleConfirmCancel}
        onClose={() => {
          setShowCancelDialog(false);
          setCancelReason('');
        }}
      />

      <RejectDialog
        isOpen={showRejectDialog}
        targetName={rejectTarget ? bookingDisplayName(rejectTarget) : ''}
        reason={rejectReason}
        onReasonChange={setRejectReason}
        onConfirm={handleConfirmReject}
        onClose={() => {
          setShowRejectDialog(false);
          setRejectTarget(null);
          setRejectReason('');
        }}
      />
    </div>
  );
}
