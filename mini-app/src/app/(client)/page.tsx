'use client';

import { CalendarCheck, CalendarDays, Clock, MessageCircle, Share2 } from 'lucide-react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RescheduleSheet } from '@/components/RescheduleSheet';
import { StatusBadge } from '@/components/StatusBadge';
import { invalidateBookings } from '@/hooks/mutations';
import { useBookings, useSessionTypes, useSpecialist, useWorkingHours } from '@/hooks/queries';
import { api, getPhotoUrl } from '@/lib/api';
import { getAvatarColor } from '@/lib/colors';
import { formatDuration } from '@/lib/helpers';
import { isTestRoute, resolveTestAwareHref } from '@/lib/routes';
import { getSpecialistId, getTelegramWebApp } from '@/lib/telegram';

import type { TBooking, TWorkingHours } from '@/lib/types';
import type { ReactNode } from 'react';

const OWNER_CACHE_KEY_PREFIX = 'specialist-owner:';
const scheduleDayOrder = [
  { day: 1, key: 'mon' },
  { day: 2, key: 'tue' },
  { day: 3, key: 'wed' },
  { day: 4, key: 'thu' },
  { day: 5, key: 'fri' },
  { day: 6, key: 'sat' },
  { day: 0, key: 'sun' },
] as const;
const ACTIVE_BOOKING_STATUSES = new Set<TBooking['status']>([
  'pending',
  'confirmed',
  'cancel_requested',
  'reschedule_pending',
]);

type TScheduleGroup = {
  dayLabel: string;
  hoursLabel: string;
  isClosed: boolean;
};

type THomeModal = 'services' | 'schedule' | null;

function getOwnerCacheKey(): string {
  return `${OWNER_CACHE_KEY_PREFIX}${getSpecialistId() ?? 'default'}`;
}

function getDayHoursLabel(dayHours: TWorkingHours[]): string {
  if (dayHours.length === 0) {
    return '';
  }

  return [...dayHours]
    .sort((left, right) => left.startTime.localeCompare(right.startTime))
    .map((item) => `${item.startTime}-${item.endTime}`)
    .join(', ');
}

function formatPrice(price: number, currency: string, locale: string): string {
  const amount = price.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU');
  return `${amount} ${currency === 'RUB' ? '\u20BD' : currency}`;
}

function formatBookingDateTime(booking: TBooking, locale: string): string {
  const startsAt = new Date(booking.startsAt);
  const date = startsAt.toLocaleDateString(locale === 'en' ? 'en-US' : 'ru-RU', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  const time = startsAt.toLocaleTimeString(locale === 'en' ? 'en-US' : 'ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });

  return `${date}, ${time}`;
}

function formatBookingDate(booking: TBooking, locale: string): string {
  return new Date(booking.startsAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatBookingTimeRange(booking: TBooking, locale: string): string {
  const formatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  } as const;
  const resolvedLocale = locale === 'en' ? 'en-US' : 'ru-RU';
  const startsAt = new Date(booking.startsAt).toLocaleTimeString(resolvedLocale, formatOptions);
  const endsAt = new Date(booking.endsAt).toLocaleTimeString(resolvedLocale, formatOptions);

  return `${startsAt} - ${endsAt}`;
}

function isDirectPhotoUrl(photoUrl: string | undefined): boolean {
  return Boolean(
    photoUrl &&
    (photoUrl.startsWith('http://') ||
      photoUrl.startsWith('https://') ||
      photoUrl.startsWith('data:') ||
      photoUrl.startsWith('blob:')),
  );
}

/***************************************************************************************************
 * Renders the home page UI and related interactions.
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
export default function HomePage(): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('HomePage');
  const tb = useTranslations('BookingDetailModal');
  const tc = useTranslations('Common');
  const td = useTranslations('Duration');
  const tdays = useTranslations('Dates.daysShort');
  const te = useTranslations('Errors');
  const ts = useTranslations('Success');
  const locale = useLocale();
  const { data: specialist, isLoading: specialistLoading } = useSpecialist();
  const { data: services, isLoading: servicesLoading } = useSessionTypes();
  const { data: workingHours, isLoading: workingHoursLoading } = useWorkingHours();
  const { data: bookings, isLoading: bookingsLoading, mutate: mutateBookings } = useBookings();
  const [bioExpanded, setBioExpanded] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [ownerRedirecting, setOwnerRedirecting] = useState(false);
  const [activeModal, setActiveModal] = useState<THomeModal>(null);
  const [selectedBooking, setSelectedBooking] = useState<TBooking | null>(null);
  const [rescheduleBooking, setRescheduleBooking] = useState<TBooking | null>(null);
  const [cancelBookingTarget, setCancelBookingTarget] = useState<TBooking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const adminHref = useMemo(() => {
    const specialistId = getSpecialistId();
    const href = `/admin${specialistId ? `?specialist=${specialistId}` : ''}`;
    return resolveTestAwareHref(pathname, href);
  }, [pathname]);
  const bookHref = useMemo(() => resolveTestAwareHref(pathname, '/book'), [pathname]);
  const bookingsHref = useMemo(() => resolveTestAwareHref(pathname, '/bookings'), [pathname]);
  const isTestInstance = isTestRoute(pathname);

  useEffect(() => {
    router.prefetch(adminHref);
    router.prefetch(bookHref);
    router.prefetch(bookingsHref);

    if (isTestInstance) {
      return;
    }

    const cachedOwner = sessionStorage.getItem(getOwnerCacheKey());
    if (cachedOwner === 'true') {
      setOwnerRedirecting(true);
      router.replace(adminHref);
    }
  }, [adminHref, bookHref, bookingsHref, isTestInstance, router]);

  /***************************************************************************************************
   * Redirect specialist to admin panel.
   ***************************************************************************************************/
  useEffect(() => {
    if (!specialist) {
      return;
    }

    sessionStorage.setItem(getOwnerCacheKey(), specialist.isOwner ? 'true' : 'false');

    if (specialist.isOwner && !isTestInstance) {
      setOwnerRedirecting(true);
      router.prefetch(adminHref);
      router.replace(adminHref);
    }
  }, [adminHref, isTestInstance, router, specialist]);

  useEffect(() => {
    setBioExpanded(false);
    setPhotoError(false);
  }, [specialist?.id, specialist?.photoUrl]);

  const isLoading = specialistLoading || servicesLoading || workingHoursLoading;

  const scheduleGroups = useMemo((): TScheduleGroup[] => {
    const hoursByDay = new Map<number, TWorkingHours[]>();

    for (const item of workingHours) {
      const dayHours = hoursByDay.get(item.dayOfWeek) ?? [];
      dayHours.push(item);
      hoursByDay.set(item.dayOfWeek, dayHours);
    }

    return scheduleDayOrder.reduce<TScheduleGroup[]>((groups, day) => {
      const rawHoursLabel = getDayHoursLabel(hoursByDay.get(day.day) ?? []);
      const hoursLabel = rawHoursLabel || t('closed');
      const previousGroup = groups[groups.length - 1];

      if (previousGroup?.hoursLabel === hoursLabel) {
        previousGroup.dayLabel = `${previousGroup.dayLabel}-${tdays(day.key)}`;
        return groups;
      }

      groups.push({
        dayLabel: tdays(day.key),
        hoursLabel,
        isClosed: rawHoursLabel === '',
      });
      return groups;
    }, []);
  }, [tdays, t, workingHours]);

  const nextBooking = useMemo(() => {
    const now = Date.now();
    return bookings
      .filter(
        (booking) =>
          ACTIVE_BOOKING_STATUSES.has(booking.status) && new Date(booking.startsAt).getTime() > now,
      )
      .sort(
        (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
      )[0];
  }, [bookings]);

  const handleMessage = (): void => {
    if (specialist?.telegramHandle) {
      const handle = specialist.telegramHandle.replace('@', '');
      window.open(`https://t.me/${handle}`, '_blank');
    } else if (specialist?.botUsername) {
      window.open(`https://t.me/${specialist.botUsername}`, '_blank');
    }
  };

  const handleShare = (): void => {
    const url = specialist?.botUsername
      ? `https://t.me/${specialist.botUsername}`
      : window.location.href;
    const webApp = getTelegramWebApp();
    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(specialist?.name || '')}`,
      );
    } else if (navigator.share) {
      void navigator.share({ title: specialist?.name, url });
    }
  };

  const handleCancelBooking = async (): Promise<void> => {
    if (!cancelBookingTarget) {
      return;
    }

    const bookingId = cancelBookingTarget.id;
    const reason = cancelReason || t('cancelDefaultReason');

    try {
      await mutateBookings(
        async (currentBookings) => {
          await api.cancelBooking(bookingId, reason);

          return (currentBookings ?? []).map((booking) =>
            booking.id === bookingId
              ? { ...booking, status: 'cancelled', cancelReason: reason }
              : booking,
          );
        },
        {
          optimisticData: (currentBookings) =>
            (currentBookings ?? []).map((booking) =>
              booking.id === bookingId
                ? { ...booking, status: 'cancelled', cancelReason: reason }
                : booking,
            ),
          rollbackOnError: true,
          populateCache: true,
          revalidate: false,
        },
      );

      toast.success(ts('bookingCancelled'));
      setSelectedBooking(null);
      setCancelBookingTarget(null);
      setCancelReason('');
      invalidateBookings();
    } catch {
      toast.error(te('bookingCancelFailed'));
    }
  };

  const handleRescheduleSuccess = (): void => {
    toast.success(ts('bookingRescheduled'));
    setSelectedBooking(null);
    setRescheduleBooking(null);
    mutateBookings();
    invalidateBookings();
  };

  if (ownerRedirecting || isLoading) {
    return (
      <div className={'animate-pulse'}>
        <div className={'bg-background h-[150px] w-full'} />
        <div className={'bg-card relative rounded-t-2xl px-4 pt-20 pb-6'}>
          <div
            className={
              'bg-border absolute top-0 left-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full'
            }
          />
          <div className={'bg-border mx-auto h-7 w-2/3 rounded'} />
          <div className={'bg-border mx-auto mt-3 h-4 w-1/2 rounded'} />
          <div className={'bg-border mt-8 h-20 rounded-lg'} />
          <div className={'mt-6 grid grid-cols-3 gap-2'}>
            <div className={'bg-border h-12 rounded-lg'} />
            <div className={'bg-border h-12 rounded-lg'} />
            <div className={'bg-border h-12 rounded-lg'} />
          </div>
        </div>
        <div className={'bg-background px-4 pt-5 pb-10'}>
          <div className={'bg-border h-6 w-32 rounded'} />
          <div className={'bg-card mt-4 h-36 rounded-lg'} />
        </div>
      </div>
    );
  }

  if (!specialist) {
    return (
      <div className={'px-4 pt-4'}>
        <div className={'bg-card text-muted-foreground rounded-lg p-4 text-center'}>
          {t('specialistLoadError')}
        </div>
      </div>
    );
  }

  const hasPhoto = specialist.photoUrl && !photoError;
  const hasMessage = Boolean(specialist.telegramHandle || specialist.botUsername);

  return (
    <div className={'bg-background'}>
      <div className={'relative h-[160px] px-4 pt-5'}>
        <button
          type={'button'}
          onClick={handleShare}
          className={
            'border-surface-border bg-card text-muted-foreground absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full border shadow-sm transition-opacity active:opacity-80'
          }
          aria-label={t('share')}
        >
          <Share2 className={'h-5 w-5'} />
        </button>
      </div>

      <section className={'bg-card relative rounded-t-[32px] px-4 pt-20 pb-6'}>
        <div className={'absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2'}>
          <div className={'bg-card rounded-full p-2'}>
            {hasPhoto ? (
              <Image
                width={112}
                height={112}
                sizes={'112px'}
                src={getPhotoUrl(specialist.photoUrl!)}
                alt={specialist.name}
                unoptimized={isDirectPhotoUrl(specialist.photoUrl)}
                className={'h-28 w-28 rounded-full object-cover'}
                onError={() => setPhotoError(true)}
              />
            ) : (
              <div
                className={`flex h-28 w-28 items-center justify-center rounded-full text-5xl font-semibold ${getAvatarColor(specialist.name)}`}
              >
                {specialist.name.charAt(0)}
              </div>
            )}
          </div>
        </div>

        <div className={'text-center'}>
          <h1 className={'text-foreground text-3xl leading-tight font-semibold'}>
            {specialist.name}
          </h1>
          {specialist.specialization && (
            <p className={'text-muted-foreground mt-2 text-base leading-snug'}>
              {specialist.specialization}
            </p>
          )}
        </div>

        {specialist.bio && (
          <div className={'mt-7'}>
            <p
              className={`text-muted-foreground text-base leading-relaxed ${
                !bioExpanded ? 'line-clamp-4' : ''
              }`}
            >
              {specialist.bio}
            </p>
            {specialist.bio.length > 160 && (
              <button
                type={'button'}
                onClick={() => setBioExpanded(!bioExpanded)}
                className={'text-brand mt-1 text-base font-medium'}
              >
                {bioExpanded ? t('hide') : t('showAll')}
              </button>
            )}
          </div>
        )}

        <div className={'mt-8 flex gap-2'}>
          <button
            type={'button'}
            onClick={() => setActiveModal('services')}
            className={
              'bg-brand flex h-12 min-w-0 flex-1 items-center justify-center rounded-lg px-2 text-sm font-medium text-white transition-opacity active:opacity-80'
            }
          >
            <span className={'truncate'}>{t('servicesButton')}</span>
          </button>
          <button
            type={'button'}
            onClick={() => setActiveModal('schedule')}
            className={
              'bg-brand flex h-12 min-w-0 flex-1 items-center justify-center rounded-lg px-2 text-sm font-medium text-white transition-opacity active:opacity-80'
            }
          >
            <span className={'truncate'}>{t('scheduleButton')}</span>
          </button>
          {hasMessage && (
            <button
              type={'button'}
              onClick={handleMessage}
              aria-label={t('messageButton')}
              className={
                'border-brand text-brand flex h-12 w-14 shrink-0 items-center justify-center rounded-lg border transition-opacity active:opacity-80'
              }
            >
              <MessageCircle className={'h-5 w-5'} />
            </button>
          )}
        </div>
      </section>

      <section className={'bg-background text-foreground min-h-[250px] px-4 pt-5 pb-8'}>
        <div className={'mb-4 flex items-center justify-between gap-4'}>
          <h2 className={'text-lg font-semibold'}>{t('yourBookings')}</h2>
          <button
            type={'button'}
            onClick={() => router.push(bookingsHref)}
            className={
              'text-muted-foreground shrink-0 text-base font-medium transition-opacity active:opacity-80'
            }
          >
            {t('viewAll')}
          </button>
        </div>

        {bookingsLoading ? (
          <div className={'bg-card h-36 animate-pulse rounded-lg'} />
        ) : nextBooking ? (
          <button
            type={'button'}
            onClick={() => setSelectedBooking(nextBooking)}
            className={
              'bg-card text-foreground w-full rounded-lg p-4 text-left transition-transform active:scale-[0.99]'
            }
          >
            <div className={'flex items-start gap-3'}>
              <div
                className={
                  'bg-background text-brand flex h-11 w-11 shrink-0 items-center justify-center rounded-lg'
                }
              >
                <CalendarDays className={'h-5 w-5'} />
              </div>
              <div className={'min-w-0 flex-1'}>
                <p className={'truncate text-base font-semibold'}>
                  {nextBooking.sessionType?.name ?? tc('workout')}
                </p>
                <p className={'text-muted-foreground mt-1 text-sm'}>
                  {formatBookingDateTime(nextBooking, locale)}
                </p>
                {(nextBooking.durationMinutes || nextBooking.sessionType?.durationMinutes) && (
                  <p className={'text-muted-foreground mt-1 text-sm'}>
                    {nextBooking.durationMinutes || nextBooking.sessionType?.durationMinutes}{' '}
                    {tc('min')}
                  </p>
                )}
              </div>
            </div>
          </button>
        ) : (
          <div className={'bg-card text-muted-foreground rounded-lg px-4 py-10 text-center'}>
            <h3 className={'text-foreground text-xl font-medium'}>{t('emptyBookingsTitle')}</h3>
            <p className={'mt-3 text-base'}>
              <button
                type={'button'}
                onClick={() => router.push(bookHref)}
                className={'text-brand font-medium'}
              >
                {t('emptyBookingsAction')}
              </button>{' '}
              {t('emptyBookingsDescription')}
            </p>
          </div>
        )}
      </section>

      <BottomSheet
        isOpen={activeModal === 'services'}
        onClose={() => setActiveModal(null)}
        title={t('servicesButton')}
        className={'pb-6'}
      >
        {services.length > 0 ? (
          <div className={'space-y-2'}>
            {services.map((service) => (
              <div
                key={service.id}
                className={'bg-background flex items-center gap-3 rounded-lg p-3'}
              >
                <div
                  className={
                    'bg-border flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg'
                  }
                >
                  {service.imageUrl ? (
                    <Image
                      width={48}
                      height={48}
                      src={getPhotoUrl(service.imageUrl)}
                      alt={service.name}
                      className={'h-full w-full object-cover'}
                    />
                  ) : (
                    <CalendarCheck className={'text-muted-foreground h-5 w-5'} />
                  )}
                </div>
                <div className={'min-w-0 flex-1'}>
                  <p className={'text-foreground truncate text-sm font-medium'}>{service.name}</p>
                  <div className={'mt-1 flex items-center gap-1'}>
                    <Clock className={'text-muted-foreground h-3.5 w-3.5'} />
                    <p className={'text-muted-foreground text-xs'}>
                      {formatDuration(service.durationMinutes, td('hour'), td('minutes'))}
                    </p>
                  </div>
                </div>
                {service.price > 0 && (
                  <p className={'text-foreground ml-2 shrink-0 text-sm font-semibold'}>
                    {formatPrice(service.price, service.currency, locale)}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className={'bg-background text-muted-foreground rounded-lg p-4 text-center text-sm'}>
            {t('servicesEmpty')}
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        isOpen={activeModal === 'schedule'}
        onClose={() => setActiveModal(null)}
        title={t('scheduleTitle')}
        className={'pb-6'}
      >
        <div className={'space-y-2'}>
          {scheduleGroups.map((group) => (
            <div
              key={`${group.dayLabel}-${group.hoursLabel}`}
              className={'bg-background flex items-center justify-between gap-4 rounded-lg p-3'}
            >
              <span className={'text-foreground text-sm font-medium'}>{group.dayLabel}</span>
              <span
                className={`text-right text-sm ${
                  group.isClosed ? 'text-muted-foreground' : 'text-foreground'
                }`}
              >
                {group.hoursLabel}
              </span>
            </div>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        title={selectedBooking?.sessionType?.name ?? tc('workout')}
        className={'pb-6'}
      >
        {selectedBooking && (
          <div>
            <div className={'mb-4 flex justify-end'}>
              <StatusBadge status={selectedBooking.status} className={'shrink-0'} />
            </div>

            <div className={'space-y-3'}>
              <div className={'border-border flex justify-between gap-4 border-b py-2'}>
                <span className={'text-muted-foreground'}>{tb('serviceLabel')}</span>
                <span className={'text-foreground text-right font-medium'}>
                  {selectedBooking.sessionType?.name ?? tc('workout')}
                </span>
              </div>
              <div className={'border-border flex justify-between gap-4 border-b py-2'}>
                <span className={'text-muted-foreground'}>{tb('dateLabel')}</span>
                <span className={'text-foreground text-right font-medium'}>
                  {formatBookingDate(selectedBooking, locale)}
                </span>
              </div>
              <div className={'border-border flex justify-between gap-4 border-b py-2'}>
                <span className={'text-muted-foreground'}>{tb('timeLabel')}</span>
                <span className={'text-foreground text-right font-medium'}>
                  {formatBookingTimeRange(selectedBooking, locale)}
                </span>
              </div>
              {(selectedBooking.durationMinutes ||
                selectedBooking.sessionType?.durationMinutes) && (
                <div className={'border-border flex justify-between gap-4 border-b py-2'}>
                  <span className={'text-muted-foreground'}>{tb('durationLabel')}</span>
                  <span className={'text-foreground text-right font-medium'}>
                    {selectedBooking.durationMinutes ||
                      selectedBooking.sessionType?.durationMinutes}{' '}
                    {tc('min')}
                  </span>
                </div>
              )}
              {selectedBooking.clientMessage && (
                <div className={'border-border border-b py-2'}>
                  <span className={'text-muted-foreground text-sm'}>{t('sessionComment')}</span>
                  <p className={'text-foreground mt-1 text-sm'}>{selectedBooking.clientMessage}</p>
                </div>
              )}
            </div>

            {(selectedBooking.status === 'pending' || selectedBooking.status === 'confirmed') && (
              <div className={'mt-5 flex gap-3'}>
                <button
                  type={'button'}
                  onClick={() => {
                    setRescheduleBooking(selectedBooking);
                    setSelectedBooking(null);
                  }}
                  className={
                    'bg-background text-foreground flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-opacity active:opacity-80'
                  }
                >
                  {tb('rescheduleButton')}
                </button>
                <button
                  type={'button'}
                  onClick={() => {
                    setCancelBookingTarget(selectedBooking);
                    setSelectedBooking(null);
                  }}
                  className={
                    'bg-action-danger-bg text-action-danger-text flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-opacity active:opacity-80'
                  }
                >
                  {tb('cancelButton')}
                </button>
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      <RescheduleSheet
        booking={rescheduleBooking}
        isOpen={!!rescheduleBooking}
        onClose={() => setRescheduleBooking(null)}
        onSuccess={handleRescheduleSuccess}
        mode={'client'}
      />

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
