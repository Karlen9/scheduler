'use client';

import { Clock, MessageCircle, Share2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RescheduleSheet } from '@/components/RescheduleSheet';
import { ServiceCard } from '@/components/ServiceCard';
import { StatusBadge } from '@/components/StatusBadge';
import { WallpaperBackground } from '@/components/WallpaperPicker';
import { invalidateBookings } from '@/hooks/mutations';
import {
  useBookings,
  useClientBatches,
  useSessionTypes,
  useSpecialist,
  useWorkingHours,
} from '@/hooks/queries';
import { useRescheduleActions } from '@/hooks/useRescheduleActions';
import { api, getPhotoUrl } from '@/lib/api';
import { getAvatarColor } from '@/lib/colors';
import { formatDateISO, nextDateForWeekday } from '@/lib/helpers';
import { isTestRoute, resolveTestAwareHref } from '@/lib/routes';
import { getSpecialistId, getTelegramWebApp } from '@/lib/telegram';

import type { TBooking, TClientBatch, TSessionType, TWorkingHours } from '@/lib/types';
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

type TScheduleRow = {
  day: number;
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

function pickDisplayBatch(service: TSessionType, batches: TClientBatch[]): TClientBatch | null {
  if (service.type !== 'batch') {
    return null;
  }

  const serviceBatches = batches.filter((batch) => batch.serviceId === service.id);
  return (
    serviceBatches.find((batch) => batch.status === 'active' && batch.remainingSessions > 0) ??
    serviceBatches.find((batch) => batch.status === 'exhausted' || batch.remainingSessions <= 0) ??
    null
  );
}

function formatBookingDateWithDay(booking: TBooking, locale: string): string {
  const resolvedLocale = locale === 'en' ? 'en-US' : 'ru-RU';
  const startsAt = new Date(booking.startsAt);
  const formatted = startsAt.toLocaleDateString(resolvedLocale, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
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
  const tdays = useTranslations('Dates.daysShort');
  const te = useTranslations('Errors');
  const ts = useTranslations('Success');
  const locale = useLocale();
  const { data: specialist, isLoading: specialistLoading } = useSpecialist();
  const { data: services, isLoading: servicesLoading } = useSessionTypes();
  const { data: clientBatches, isLoading: batchesLoading } = useClientBatches();
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
  const reschedule = useRescheduleActions();
  const adminHref = useMemo(() => {
    const specialistId = getSpecialistId();
    const href = `/admin${specialistId ? `?specialist=${specialistId}` : ''}`;
    return resolveTestAwareHref(pathname, href);
  }, [pathname]);
  const bookHref = useMemo(() => resolveTestAwareHref(pathname, '/book'), [pathname]);
  const bookingsHref = useMemo(() => resolveTestAwareHref(pathname, '/bookings'), [pathname]);
  const isTestInstance = isTestRoute(pathname);
  const batchByService = useMemo(() => {
    const result = new Map<string, TClientBatch | null>();
    for (const service of services) {
      result.set(service.id, pickDisplayBatch(service, clientBatches));
    }
    return result;
  }, [clientBatches, services]);

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

  const scheduleRows = useMemo((): TScheduleRow[] => {
    const hoursByDay = new Map<number, TWorkingHours[]>();

    for (const item of workingHours) {
      const dayHours = hoursByDay.get(item.dayOfWeek) ?? [];
      dayHours.push(item);
      hoursByDay.set(item.dayOfWeek, dayHours);
    }

    return scheduleDayOrder.map((day) => {
      const rawHoursLabel = getDayHoursLabel(hoursByDay.get(day.day) ?? []);
      return {
        day: day.day,
        dayLabel: tdays(day.key),
        hoursLabel: rawHoursLabel || t('closed'),
        isClosed: rawHoursLabel === '',
      };
    });
  }, [tdays, t, workingHours]);

  /***************************************************************************************************
   * Collapse reschedule_pending shadows over their originals so the home hero / badge count
   * treat the admin's proposal as a replacement rather than a duplicate booking.
   ***************************************************************************************************/
  const activeBookings = useMemo(() => {
    const now = Date.now();
    const all = bookings.filter(
      (booking) =>
        ACTIVE_BOOKING_STATUSES.has(booking.status) && new Date(booking.startsAt).getTime() > now,
    );
    const replacedIds = new Set<string>(
      all
        .filter((b) => b.status === 'reschedule_pending' && b.replacesBookingId)
        .map((b) => b.replacesBookingId as string),
    );
    return all.filter((b) => !replacedIds.has(b.id));
  }, [bookings]);

  const nextBooking = useMemo(
    () =>
      [...activeBookings].sort(
        (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
      )[0],
    [activeBookings],
  );

  const activeBookingsCount = activeBookings.length;

  const formatCountdown = useCallback(
    (diffMs: number): string => {
      const totalMinutes = Math.floor(diffMs / 60_000);
      const days = Math.floor(totalMinutes / 1440);
      const hours = Math.floor((totalMinutes % 1440) / 60);
      const minutes = totalMinutes % 60;

      let timePart: string;
      if (locale === 'en') {
        if (days > 0) {
          timePart = hours > 0 ? `${days}d ${hours}h` : `${days}d`;
        } else if (hours > 0) {
          timePart = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
        } else {
          timePart = `${Math.max(1, minutes)}m`;
        }
      } else {
        if (days > 0) {
          timePart = hours > 0 ? `${days} д. ${hours} ч.` : `${days} д.`;
        } else if (hours > 0) {
          timePart = minutes > 0 ? `${hours} ч. ${minutes} мин.` : `${hours} ч.`;
        } else {
          timePart = `${Math.max(1, minutes)} мин.`;
        }
      }

      return t('startsIn', { time: timePart });
    },
    [locale, t],
  );

  const [countdownLabel, setCountdownLabel] = useState('');

  useEffect(() => {
    if (!nextBooking) {
      setCountdownLabel('');
      return;
    }

    const update = (): void => {
      const diffMs = new Date(nextBooking.startsAt).getTime() - Date.now();
      setCountdownLabel(diffMs > 0 ? formatCountdown(diffMs) : '');
    };

    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [nextBooking, formatCountdown]);

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
              'bg-skeleton absolute top-0 left-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full'
            }
          />
          <div className={'bg-skeleton mx-auto h-7 w-2/3 rounded'} />
          <div className={'bg-skeleton mx-auto mt-3 h-4 w-1/2 rounded'} />
          <div className={'bg-skeleton mt-8 h-20 rounded-lg'} />
          <div className={'mt-6 grid grid-cols-3 gap-2'}>
            <div className={'bg-skeleton h-12 rounded-lg'} />
            <div className={'bg-skeleton h-12 rounded-lg'} />
            <div className={'bg-skeleton h-12 rounded-lg'} />
          </div>
        </div>
        <div className={'bg-background px-4 pt-5 pb-10'}>
          <div className={'bg-skeleton h-6 w-32 rounded'} />
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
  const photoSrc = hasPhoto ? getPhotoUrl(specialist.photoUrl) : null;
  const hasMessage = Boolean(specialist.telegramHandle || specialist.botUsername);

  return (
    <div className={'bg-bookings-bg -mb-[calc(7rem+env(safe-area-inset-bottom))] min-h-screen'}>
      <div className={'bg-background relative h-[192px] overflow-hidden'}>
        <WallpaperBackground wallpaper={specialist.wallpaper} />
        <div
          className={
            'from-brand/10 pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t to-transparent'
          }
        />
        <div className={'relative h-[160px] px-4 pt-5'}>
          <button
            type={'button'}
            onClick={handleShare}
            className={
              'border-brand/20 bg-brand/10 text-brand absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition-opacity active:opacity-80'
            }
            aria-label={t('share')}
          >
            <Share2 className={'h-5 w-5'} />
          </button>
        </div>
      </div>

      <section className={'bg-card relative -mt-8 rounded-[16px] px-4 pt-20 pb-14'}>
        <div className={'absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2'}>
          <div className={'bg-card ring-brand/20 rounded-full p-2 ring-2'}>
            {photoSrc ? (
              <Image
                width={112}
                height={112}
                sizes={'112px'}
                src={photoSrc}
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
              className={`text-muted-foreground text-base leading-relaxed whitespace-pre-wrap ${
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
              'bg-brand text-primary-foreground flex h-12 min-w-0 flex-1 items-center justify-center rounded-lg px-2 text-sm font-medium transition-opacity active:opacity-80'
            }
          >
            <span className={'truncate'}>{t('servicesButton')}</span>
          </button>
          <button
            type={'button'}
            onClick={() => setActiveModal('schedule')}
            className={
              'bg-brand text-primary-foreground flex h-12 min-w-0 flex-1 items-center justify-center rounded-lg px-2 text-sm font-medium transition-opacity active:opacity-80'
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

      <section
        className={
          'bg-bookings-bg relative z-10 -mt-8 min-h-[250px] rounded-t-[16px] px-4 pt-5 pb-[calc(7rem+env(safe-area-inset-bottom))] text-white'
        }
      >
        <div className={'mb-4 flex items-center justify-between gap-4'}>
          <h2 className={'flex items-center gap-2 text-lg font-semibold'}>
            {t('yourBookings')}
            {activeBookingsCount > 0 && (
              <span
                className={
                  'text-bookings-bg inline-flex size-6 items-center justify-center rounded-full bg-white text-sm font-bold'
                }
              >
                {activeBookingsCount}
              </span>
            )}
          </h2>
          <button
            type={'button'}
            onClick={() => router.push(bookingsHref)}
            className={
              'shrink-0 text-base font-medium text-white/70 transition-opacity active:opacity-80'
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
            {countdownLabel && (
              <div className={'text-brand mb-2 flex items-center gap-1.5 text-sm font-medium'}>
                <Clock className={'h-3.5 w-3.5 shrink-0'} />
                <span>{countdownLabel}</span>
              </div>
            )}
            <p className={'mb-3 truncate text-base font-semibold'}>
              {nextBooking.sessionType?.name ?? tc('workout')}
            </p>
            <div className={'bg-bookings-bg grid grid-cols-2 rounded-lg text-sm text-white'}>
              <span
                className={'border-surface truncate border-r-2 px-3 py-2.5 text-center font-medium'}
              >
                {formatBookingDateWithDay(nextBooking, locale)}
              </span>
              <span className={'px-3 py-2.5 text-center font-medium'}>
                {formatBookingTimeRange(nextBooking, locale)}
              </span>
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
          batchesLoading ? (
            <div className={'animate-pulse space-y-3'}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={'bg-card rounded-xl p-4'}>
                  <div className={'bg-skeleton mb-3 h-4 w-2/3 rounded'} />
                  <div className={'bg-skeleton h-3 w-1/2 rounded'} />
                </div>
              ))}
            </div>
          ) : (
            <div className={'space-y-3'}>
              {services.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  clientBatch={batchByService.get(service.id)}
                  clickLabel={t('bookService')}
                  onClick={() => {
                    setActiveModal(null);
                    router.push(resolveTestAwareHref(pathname, `/book?service=${service.id}`));
                  }}
                />
              ))}
            </div>
          )
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
          {scheduleRows.map((row) =>
            row.isClosed ? (
              <div
                key={row.day}
                className={'bg-background flex items-center justify-between gap-4 rounded-lg p-3'}
              >
                <span className={'text-foreground text-sm font-medium'}>{row.dayLabel}</span>
                <span className={'text-muted-foreground text-right text-sm'}>{row.hoursLabel}</span>
              </div>
            ) : (
              <Link
                key={row.day}
                href={resolveTestAwareHref(
                  pathname,
                  `/book?date=${formatDateISO(nextDateForWeekday(row.day, new Date()))}`,
                )}
                onClick={() => setActiveModal(null)}
                className={
                  'bg-background flex items-center justify-between gap-4 rounded-lg p-3 transition-opacity active:opacity-80'
                }
              >
                <span className={'text-foreground text-sm font-medium'}>{row.dayLabel}</span>
                <span className={'text-foreground text-right text-sm'}>{row.hoursLabel}</span>
              </Link>
            ),
          )}
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
              {selectedBooking.clientMessage && selectedBooking.status !== 'reschedule_pending' && (
                <div className={'border-border border-b py-2'}>
                  <span className={'text-muted-foreground text-sm'}>{t('sessionComment')}</span>
                  <p className={'text-foreground mt-1 text-sm'}>{selectedBooking.clientMessage}</p>
                </div>
              )}
              {selectedBooking.status === 'reschedule_pending' && selectedBooking.clientMessage && (
                <div className={'border-border border-b py-2'}>
                  <span className={'text-muted-foreground text-sm'}>{tb('specialistNote')}</span>
                  <p className={'text-foreground mt-1 text-sm whitespace-pre-wrap'}>
                    {selectedBooking.clientMessage}
                  </p>
                </div>
              )}
            </div>

            {selectedBooking.status === 'reschedule_pending' ? (
              <div className={'mt-5 flex gap-3'}>
                <button
                  type={'button'}
                  disabled={reschedule.pending}
                  onClick={async () => {
                    const target = selectedBooking;
                    setSelectedBooking(null);
                    await reschedule.approve(target);
                  }}
                  className={
                    'bg-action-confirm-bg text-action-confirm-text flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-opacity active:opacity-80 disabled:opacity-60'
                  }
                >
                  {tb('approveRescheduleButton')}
                </button>
                <button
                  type={'button'}
                  disabled={reschedule.pending}
                  onClick={async () => {
                    const target = selectedBooking;
                    setSelectedBooking(null);
                    await reschedule.decline(target);
                  }}
                  className={
                    'bg-action-danger-bg text-action-danger-text flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-opacity active:opacity-80 disabled:opacity-60'
                  }
                >
                  {tb('declineRescheduleButton')}
                </button>
              </div>
            ) : selectedBooking.status === 'pending' || selectedBooking.status === 'confirmed' ? (
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
            ) : null}
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
        confirmText={tc('yes')}
        cancelText={tc('no')}
        destructive
        showInput
        inputPlaceholder={t('cancelReasonPlaceholder')}
        inputValue={cancelReason}
        onInputChange={setCancelReason}
      />
    </div>
  );
}
