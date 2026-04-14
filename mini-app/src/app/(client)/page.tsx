'use client';

import { Clock, Dumbbell, MessageCircle, Phone, Share2 } from 'lucide-react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { useSessionTypes, useSpecialist, useWorkingHours } from '@/hooks/queries';
import { getPhotoUrl } from '@/lib/api';
import { getAvatarColor } from '@/lib/colors';
import { formatDuration } from '@/lib/helpers';
import { isTestRoute, resolveTestAwareHref } from '@/lib/routes';
import { getSpecialistId, getTelegramWebApp } from '@/lib/telegram';

import type { TWorkingHours } from '@/lib/types';
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

type TScheduleGroup = {
  dayLabel: string;
  hoursLabel: string;
  isClosed: boolean;
};

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
  /***************************************************************************************************
   * Defines the router value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const router = useRouter();
  const pathname = usePathname();
  /***************************************************************************************************
   * Defines the t value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('HomePage');
  /***************************************************************************************************
   * Defines the td value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const td = useTranslations('Duration');
  const tdays = useTranslations('Dates.daysShort');
  /***************************************************************************************************
   * Defines the locale value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const locale = useLocale();
  const { data: specialist, isLoading: specialistLoading } = useSpecialist();
  const { data: services, isLoading: servicesLoading } = useSessionTypes();
  const { data: workingHours, isLoading: workingHoursLoading } = useWorkingHours();
  const [bioExpanded, setBioExpanded] = useState(false);
  const [heroError, setHeroError] = useState(false);
  const [ownerRedirecting, setOwnerRedirecting] = useState(false);
  const adminHref = useMemo(() => {
    const specialistId = getSpecialistId();
    const href = `/admin${specialistId ? `?specialist=${specialistId}` : ''}`;
    return resolveTestAwareHref(pathname, href);
  }, [pathname]);
  const isTestInstance = isTestRoute(pathname);

  useEffect(() => {
    router.prefetch(adminHref);

    if (isTestInstance) {
      return;
    }

    const cachedOwner = sessionStorage.getItem(getOwnerCacheKey());
    if (cachedOwner === 'true') {
      setOwnerRedirecting(true);
      router.replace(adminHref);
    }
  }, [adminHref, isTestInstance, router]);

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
  }, [specialist?.id]);

  /***************************************************************************************************
   * Defines the is loading value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
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

  /***************************************************************************************************
   * Handles message.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleMessage = (): void => {
    if (specialist?.telegramHandle) {
      /***************************************************************************************************
       * Defines the handle value used by the page layer.
       *
       * Usage context:
       * - Reused by the page layer to keep shared values centralized.
       ***************************************************************************************************/
      const handle = specialist.telegramHandle.replace('@', '');
      window.open(`https://t.me/${handle}`, '_blank');
    } else if (specialist?.botUsername) {
      window.open(`https://t.me/${specialist.botUsername}`, '_blank');
    }
  };

  /***************************************************************************************************
   * Handles share.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleShare = (): void => {
    /***************************************************************************************************
     * Defines the url value used by the page layer.
     *
     * Usage context:
     * - Reused by the page layer to keep shared values centralized.
     ***************************************************************************************************/
    const url = `https://t.me/${specialist?.botUsername}`;
    /***************************************************************************************************
     * Defines the web app value used by the page layer.
     *
     * Usage context:
     * - Reused by the page layer to keep shared values centralized.
     ***************************************************************************************************/
    const webApp = getTelegramWebApp();
    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(specialist?.name || '')}`,
      );
    } else if (navigator.share) {
      navigator.share({ title: specialist?.name, url });
    }
  };

  if (ownerRedirecting || isLoading) {
    return (
      <div className={'animate-pulse'}>
        {/***************************************************************************************************
         * Hero skeleton.
         ***************************************************************************************************/}
        <div className={'bg-border h-[280px] w-full'} />
        {/***************************************************************************************************
         * Card skeleton.
         ***************************************************************************************************/}
        <div className={'bg-card relative -mt-6 space-y-4 rounded-t-2xl px-4 pt-6 pb-4'}>
          <div className={'bg-border h-7 w-2/3 rounded'} />
          <div className={'bg-border h-4 w-1/2 rounded'} />
          <div className={'bg-border h-3 w-3/4 rounded'} />
          <div className={'flex gap-2 pt-2'}>
            <div className={'bg-border h-12 flex-1 rounded-[28px]'} />
            <div className={'bg-border h-12 flex-1 rounded-[28px]'} />
            <div className={'bg-border h-12 w-12 rounded-[28px]'} />
          </div>
          <div className={'space-y-3 pt-4'}>
            <div className={'bg-border h-5 w-24 rounded'} />
            <div className={'bg-border h-16 rounded-xl'} />
            <div className={'bg-border h-24 rounded-xl'} />
            <div className={'bg-border h-16 rounded-xl'} />
          </div>
        </div>
      </div>
    );
  }

  if (!specialist) {
    return (
      <div className={'px-4 pt-4'}>
        <div className={'bg-card text-muted-foreground rounded-xl p-4 text-center'}>
          {t('specialistLoadError')}
        </div>
      </div>
    );
  }

  /***************************************************************************************************
   * Defines the has photo value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const hasPhoto = specialist.photoUrl && !heroError;

  return (
    <div>
      {/***************************************************************************************************
       * Hero Section.
       ***************************************************************************************************/}
      <div className={'relative h-[280px] w-full overflow-hidden'}>
        {hasPhoto ? (
          <>
            <Image
              width={100}
              height={100}
              src={getPhotoUrl(specialist.photoUrl!)}
              alt={specialist.name}
              className={'h-full w-full object-cover'}
              onError={() => setHeroError(true)}
            />
            <div
              className={
                'absolute inset-0 bg-linear-to-t from-black/60 via-black/20 to-transparent'
              }
            />
          </>
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center text-7xl ${getAvatarColor(specialist.name)}`}
          >
            {specialist.name.charAt(0)}
          </div>
        )}
      </div>

      {/***************************************************************************************************
       * Specialist Info Card.
       ***************************************************************************************************/}
      <div className={'bg-card relative z-10 -mt-6 rounded-t-2xl'}>
        <div className={'space-y-4 px-4 pt-6 pb-4'}>
          {/***************************************************************************************************
           * Name & specialization.
           ***************************************************************************************************/}
          <div>
            <h1 className={'text-foreground text-2xl leading-tight font-bold'}>
              {specialist.name}
            </h1>
            {specialist.specialization && (
              <p className={'text-muted-foreground mt-1 text-sm'}>{specialist.specialization}</p>
            )}
          </div>

          {/***************************************************************************************************
           * Contact row.
           ***************************************************************************************************/}
          {(specialist.phone || specialist.telegramHandle) && (
            <div className={'flex items-center gap-4'}>
              {specialist.phone && (
                <a
                  href={`tel:${specialist.phone}`}
                  className={'text-muted-foreground flex items-center gap-1.5'}
                >
                  <Phone className={'h-3.5 w-3.5'} />
                  <span className={'text-xs'}>{specialist.phone}</span>
                </a>
              )}
              {specialist.telegramHandle && (
                <div className={'text-muted-foreground flex items-center gap-1.5'}>
                  <MessageCircle className={'h-3.5 w-3.5'} />
                  <span className={'text-xs'}>{specialist.telegramHandle}</span>
                </div>
              )}
            </div>
          )}

          {/***************************************************************************************************
           * Bio Section.
           ***************************************************************************************************/}
          {specialist.bio && (
            <div>
              <p
                className={`text-muted-foreground text-sm leading-relaxed ${
                  !bioExpanded ? 'line-clamp-4' : ''
                }`}
              >
                {specialist.bio}
              </p>
              {specialist.bio.length > 200 && (
                <button
                  onClick={() => setBioExpanded(!bioExpanded)}
                  className={'text-brand mt-1 text-sm font-medium'}
                >
                  {bioExpanded ? t('hide') : t('showAll')}
                </button>
              )}
            </div>
          )}

          {/***************************************************************************************************
           * Action Buttons.
           ***************************************************************************************************/}
          <div className={'flex gap-2'}>
            {(specialist.telegramHandle || specialist.botUsername) && (
              <button
                onClick={handleMessage}
                className={
                  'bg-brand flex-1 rounded-[28px] px-4 py-3 text-sm font-medium text-white transition-opacity active:opacity-80'
                }
              >
                {t('messageButton')}
              </button>
            )}
            <button
              onClick={() => router.push(resolveTestAwareHref(pathname, '/services'))}
              className={
                'bg-surface-hover border-surface-border text-muted-foreground flex-1 rounded-[28px] border px-4 py-3 text-sm font-medium transition-opacity active:opacity-80'
              }
            >
              {t('servicesButton')}
            </button>
            <button
              onClick={handleShare}
              className={
                'bg-surface-hover border-surface-border flex h-12 w-12 items-center justify-center rounded-[28px] border transition-opacity active:opacity-80'
              }
            >
              <Share2 className={'text-muted-foreground h-4 w-4'} />
            </button>
          </div>
        </div>

        {/***************************************************************************************************
         * Schedule Section.
         ***************************************************************************************************/}
        <div className={'px-4 pb-4'}>
          <h3 className={'text-foreground mb-2 text-sm font-semibold'}>{t('scheduleTitle')}</h3>
          <div className={'bg-background rounded-xl p-3'}>
            <div className={'space-y-2'}>
              {scheduleGroups.map((group) => (
                <div
                  key={`${group.dayLabel}-${group.hoursLabel}`}
                  className={'flex items-center justify-between gap-4'}
                >
                  <span className={'text-foreground text-sm font-medium'}>{group.dayLabel}</span>
                  <span
                    className={`text-right text-xs ${group.isClosed ? 'text-muted-foreground' : 'text-foreground'}`}
                  >
                    {group.hoursLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/***************************************************************************************************
         * Services Section.
         ***************************************************************************************************/}
        {services.length > 0 && (
          <div className={'px-4 pb-4'}>
            <h3 className={'text-foreground mb-2 text-sm font-semibold'}>{t('servicesTitle')}</h3>
            <div className={'space-y-2'}>
              {services.map((service) => (
                <div
                  key={service.id}
                  className={'bg-background flex items-center gap-3 rounded-xl p-3'}
                >
                  {/***************************************************************************************************
                   * Service thumbnail.
                   ***************************************************************************************************/}
                  <div
                    className={
                      'bg-border flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full'
                    }
                  >
                    {service.imageUrl ? (
                      <Image
                        width={40}
                        height={40}
                        src={getPhotoUrl(service.imageUrl)}
                        alt={service.name}
                        className={'h-full w-full object-cover'}
                      />
                    ) : (
                      <Dumbbell className={'text-muted-foreground h-4 w-4'} />
                    )}
                  </div>
                  {/***************************************************************************************************
                   * Service info.
                   ***************************************************************************************************/}
                  <div className={'min-w-0 flex-1'}>
                    <p className={'text-foreground text-sm font-medium'}>{service.name}</p>
                    <div className={'mt-0.5 flex items-center gap-1'}>
                      <Clock className={'text-muted-foreground h-3 w-3'} />
                      <p className={'text-muted-foreground text-xs'}>
                        {formatDuration(service.durationMinutes, td('hour'), td('minutes'))}
                      </p>
                    </div>
                  </div>
                  {service.price > 0 && (
                    <p className={'text-foreground ml-2 shrink-0 text-sm font-semibold'}>
                      {service.price.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')}{' '}
                      {service.currency === 'RUB' ? '\u20BD' : service.currency}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/***************************************************************************************************
         * Location Section.
         ***************************************************************************************************/}
        {specialist.locationLatitude && specialist.locationLongitude && (
          <div className={'px-4 pb-4'}>
            <h3 className={'text-foreground mb-2 text-sm font-semibold'}>{t('locationTitle')}</h3>
            <a
              href={`https://yandex.ru/maps/?pt=${specialist.locationLongitude},${specialist.locationLatitude}&z=15&l=map`}
              target={'_blank'}
              rel={'noopener noreferrer'}
              className={'bg-background block overflow-hidden rounded-xl'}
            >
              <iframe
                src={`https://yandex.ru/map-widget/v1/?ll=${specialist.locationLongitude},${specialist.locationLatitude}&z=15&pt=${specialist.locationLongitude},${specialist.locationLatitude},pm2rdm`}
                width={'100%'}
                height={'200'}
                style={{ border: 'none', display: 'block', pointerEvents: 'none' }}
                allowFullScreen
              />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
