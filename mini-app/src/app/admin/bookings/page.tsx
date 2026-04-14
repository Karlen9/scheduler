'use client';

import { CalendarX, ChevronLeft, ChevronRight, Filter, ListChecks, Search } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { BookingDetailModal } from '@/components/BookingDetailModal';
import { BottomSheet } from '@/components/BottomSheet';
import { ClientAvatar } from '@/components/ClientAvatar';
import { EmptyState } from '@/components/EmptyState';
import { RescheduleSheet } from '@/components/RescheduleSheet';
import { StatusBadge } from '@/components/StatusBadge';
import { TopBar } from '@/components/TopBar';
import { invalidateBookings } from '@/hooks/mutations';
import { useAdminBookingsPage, useAdminServices } from '@/hooks/queries';
import { api } from '@/lib/api';
import { resolveTestAwareHref } from '@/lib/routes';
import { getTelegramWebApp } from '@/lib/telegram';

import { CancelDialog } from '../CancelDialog';
import { RejectDialog } from '../RejectDialog';

import type { TAdminBookingsQuery, TAdminBookingsSort, TBooking } from '@/lib/types';
import type { ReactNode } from 'react';

const PAGE_LIMIT = 20;

const statusOptions: TBooking['status'][] = [
  'pending',
  'confirmed',
  'cancel_requested',
  'reschedule_pending',
  'completed',
  'cancelled',
  'rejected',
];

const sortOptions: TAdminBookingsSort[] = [
  'created_desc',
  'starts_at_asc',
  'starts_at_desc',
  'status_asc',
];

type TBookingPageFilters = {
  status: TBooking['status'] | '';
  dateFrom: string;
  dateTo: string;
  client: string;
  serviceId: string;
  sort: TAdminBookingsSort;
};

const defaultFilters: TBookingPageFilters = {
  status: '',
  dateFrom: '',
  dateTo: '',
  client: '',
  serviceId: '',
  sort: 'created_desc',
};

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

export default function AdminAllBookingsPage(): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('AdminAllBookings');
  const tc = useTranslations('Common');
  const te = useTranslations('Errors');
  const ts = useTranslations('Success');
  const tst = useTranslations('Status');

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TBookingPageFilters>({ ...defaultFilters });
  const [draftFilters, setDraftFilters] = useState<TBookingPageFilters>({ ...defaultFilters });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<TBooking | null>(null);
  const [rescheduleBooking, setRescheduleBooking] = useState<TBooking | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<TBooking | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const query = useMemo<TAdminBookingsQuery>(
    () => ({
      page,
      limit: PAGE_LIMIT,
      status: filters.status,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      client: filters.client,
      serviceId: filters.serviceId,
      sort: filters.sort,
    }),
    [filters, page],
  );

  const { data, isLoading, error, mutate } = useAdminBookingsPage(query);
  const { data: services } = useAdminServices();

  useEffect(() => {
    if (data.totalPages > 0 && page > data.totalPages) {
      setPage(data.totalPages);
    }
  }, [data.totalPages, page]);

  const activeFiltersCount = [
    filters.status,
    filters.dateFrom,
    filters.dateTo,
    filters.client,
    filters.serviceId,
  ].filter(Boolean).length;

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

  const applyFilters = (): void => {
    setFilters(draftFilters);
    setPage(1);
    setShowFilters(false);
  };

  const resetFilters = (): void => {
    const nextFilters = { ...defaultFilters };
    setDraftFilters(nextFilters);
    setFilters(nextFilters);
    setPage(1);
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
    if (booking.clientIsGhost || !booking.clientTelegramUserId) {
      toast.error(t('dmUnavailable'));
      return;
    }

    const url = `tg://user?id=${booking.clientTelegramUserId}`;
    try {
      const webApp = getTelegramWebApp();
      if (webApp?.openTelegramLink) {
        webApp.openTelegramLink(url);
      } else {
        window.location.href = url;
      }
    } catch {
      window.location.href = url;
    }
  };

  const displayTotalPages = Math.max(data.totalPages, 1);
  const canGoBack = page > 1;
  const canGoForward = data.totalPages > 0 && page < data.totalPages;

  return (
    <div>
      <TopBar
        title={t('title')}
        showBack
        onBack={() => router.push(resolveTestAwareHref(pathname, '/admin'))}
      />

      <div className={'space-y-4 p-4'}>
        <div className={'flex items-center justify-between gap-3'}>
          <div className={'min-w-0'}>
            <p className={'text-muted-foreground text-sm'}>
              {t('totalCount', { count: data.total })}
            </p>
            <h2 className={'text-foreground text-xl font-semibold'}>{t('title')}</h2>
          </div>
          <button
            type={'button'}
            onClick={() => {
              setDraftFilters(filters);
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

        {isLoading && data.bookings.length === 0 ? (
          <div className={'space-y-3'}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className={'bg-card flex animate-pulse items-center gap-3 rounded-xl p-4'}
              >
                <div className={'bg-border h-10 w-10 rounded-full'} />
                <div className={'min-w-0 flex-1 space-y-2'}>
                  <div className={'bg-border h-4 w-1/2 rounded'} />
                  <div className={'bg-border h-3 w-2/3 rounded'} />
                </div>
              </div>
            ))}
          </div>
        ) : data.bookings.length === 0 ? (
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
            {data.bookings.map((booking) => (
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
                />
                <div className={'min-w-0 flex-1'}>
                  <div className={'mb-1 flex items-center gap-2'}>
                    <span className={'text-foreground truncate font-medium'}>
                      {bookingDisplayName(booking)}
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
          </div>
        )}

        {data.total > 0 && (
          <div className={'flex items-center justify-between gap-3 py-2'}>
            <button
              type={'button'}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={!canGoBack}
              className={
                'bg-card text-foreground flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40'
              }
            >
              <ChevronLeft className={'h-4 w-4'} />
              {t('previous')}
            </button>
            <span className={'text-muted-foreground text-sm'}>
              {t('pageStatus', { page, totalPages: displayTotalPages })}
            </span>
            <button
              type={'button'}
              onClick={() => setPage((value) => value + 1)}
              disabled={!canGoForward}
              className={
                'bg-card text-foreground flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40'
              }
            >
              {t('next')}
              <ChevronRight className={'h-4 w-4'} />
            </button>
          </div>
        )}
      </div>

      <BottomSheet
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        title={t('filtersTitle')}
        className={'max-h-[85vh] overflow-y-auto'}
      >
        <div className={'space-y-4'}>
          <label className={'block space-y-1'}>
            <span className={'text-muted-foreground text-sm'}>{t('clientSearch')}</span>
            <div className={'relative'}>
              <Search
                className={
                  'text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2'
                }
              />
              <input
                value={draftFilters.client}
                onChange={(event) =>
                  setDraftFilters((value) => ({ ...value, client: event.target.value }))
                }
                placeholder={t('clientSearchPlaceholder')}
                className={
                  'border-border bg-background text-foreground focus:border-brand w-full rounded-lg border py-2 pr-3 pl-9 text-sm outline-none'
                }
              />
            </div>
          </label>

          <label className={'block space-y-1'}>
            <span className={'text-muted-foreground text-sm'}>{t('status')}</span>
            <select
              value={draftFilters.status}
              onChange={(event) =>
                setDraftFilters((value) => ({
                  ...value,
                  status: event.target.value as TBooking['status'] | '',
                }))
              }
              className={
                'border-border bg-background text-foreground focus:border-brand w-full rounded-lg border px-3 py-2 text-sm outline-none'
              }
            >
              <option value={''}>{t('allStatuses')}</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {tst(statusTranslationKeys[status])}
                </option>
              ))}
            </select>
          </label>

          <div className={'grid grid-cols-2 gap-3'}>
            <label className={'block space-y-1'}>
              <span className={'text-muted-foreground text-sm'}>{t('dateFrom')}</span>
              <input
                type={'date'}
                value={draftFilters.dateFrom}
                onChange={(event) =>
                  setDraftFilters((value) => ({ ...value, dateFrom: event.target.value }))
                }
                className={
                  'border-border bg-background text-foreground focus:border-brand w-full rounded-lg border px-3 py-2 text-sm outline-none'
                }
              />
            </label>
            <label className={'block space-y-1'}>
              <span className={'text-muted-foreground text-sm'}>{t('dateTo')}</span>
              <input
                type={'date'}
                value={draftFilters.dateTo}
                onChange={(event) =>
                  setDraftFilters((value) => ({ ...value, dateTo: event.target.value }))
                }
                className={
                  'border-border bg-background text-foreground focus:border-brand w-full rounded-lg border px-3 py-2 text-sm outline-none'
                }
              />
            </label>
          </div>

          <label className={'block space-y-1'}>
            <span className={'text-muted-foreground text-sm'}>{t('service')}</span>
            <select
              value={draftFilters.serviceId}
              onChange={(event) =>
                setDraftFilters((value) => ({ ...value, serviceId: event.target.value }))
              }
              className={
                'border-border bg-background text-foreground focus:border-brand w-full rounded-lg border px-3 py-2 text-sm outline-none'
              }
            >
              <option value={''}>{t('allServices')}</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>

          <label className={'block space-y-1'}>
            <span className={'text-muted-foreground text-sm'}>{t('sort')}</span>
            <select
              value={draftFilters.sort}
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
              onClick={resetFilters}
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
