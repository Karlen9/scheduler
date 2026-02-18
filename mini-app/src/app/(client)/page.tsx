'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Clock, Phone, MessageCircle, Share2, Dumbbell } from 'lucide-react';
import { formatDuration } from '@/components/DurationSelector';
import { getPhotoUrl } from '@/lib/api';
import { getAvatarColor } from '@/lib/colors';
import { getSpecialistId } from '@/lib/telegram';
import { useSpecialist, useSessionTypes } from '@/hooks/queries';

export default function HomePage() {
  const router = useRouter();
  const t = useTranslations('HomePage');
  const td = useTranslations('Duration');
  const locale = useLocale();
  const { data: specialist, isLoading: specialistLoading } = useSpecialist();
  const { data: services, isLoading: servicesLoading } = useSessionTypes();
  const [bioExpanded, setBioExpanded] = useState(false);
  const [heroError, setHeroError] = useState(false);

  // Redirect specialist to admin panel
  useEffect(() => {
    if (specialist?.isOwner) {
      const specialistId = getSpecialistId();
      router.replace(`/admin${specialistId ? `?specialist=${specialistId}` : ''}`);
    }
  }, [specialist, router]);

  const isLoading = specialistLoading || servicesLoading;

  const handleMessage = () => {
    if (specialist?.telegramHandle) {
      const handle = specialist.telegramHandle.replace('@', '');
      window.open(`https://t.me/${handle}`, '_blank');
    } else if (specialist?.botUsername) {
      window.open(`https://t.me/${specialist.botUsername}`, '_blank');
    }
  };

  const handleShare = () => {
    const url = `https://t.me/${specialist?.botUsername}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webApp = window.Telegram?.WebApp as any;
    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(specialist?.name || '')}`,
      );
    } else if (navigator.share) {
      navigator.share({ title: specialist?.name, url });
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        {/* Hero skeleton */}
        <div className="bg-border h-[280px] w-full" />
        {/* Card skeleton */}
        <div className="bg-card relative -mt-6 space-y-4 rounded-t-2xl px-4 pt-6 pb-4">
          <div className="bg-border h-7 w-2/3 rounded" />
          <div className="bg-border h-4 w-1/2 rounded" />
          <div className="bg-border h-3 w-3/4 rounded" />
          <div className="flex gap-2 pt-2">
            <div className="bg-border h-12 flex-1 rounded-[28px]" />
            <div className="bg-border h-12 flex-1 rounded-[28px]" />
            <div className="bg-border h-12 w-12 rounded-[28px]" />
          </div>
          <div className="space-y-3 pt-4">
            <div className="bg-border h-5 w-24 rounded" />
            <div className="bg-border h-16 rounded-xl" />
            <div className="bg-border h-16 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!specialist) {
    return (
      <div className="px-4 pt-4">
        <div className="bg-card text-muted-foreground rounded-xl p-4 text-center">
          {t('trainerLoadError')}
        </div>
      </div>
    );
  }

  const hasPhoto = specialist.photoUrl && !heroError;

  return (
    <div>
      {/* Hero Section */}
      <div className="relative h-[280px] w-full overflow-hidden">
        {hasPhoto ? (
          <>
            <img
              src={getPhotoUrl(specialist.photoUrl!)}
              alt={specialist.name}
              className="h-full w-full object-cover"
              onError={() => setHeroError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          </>
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center text-7xl ${getAvatarColor(specialist.name)}`}
          >
            {specialist.name.charAt(0)}
          </div>
        )}
      </div>

      {/* Specialist Info Card */}
      <div className="bg-card relative z-10 -mt-6 rounded-t-2xl">
        <div className="space-y-4 px-4 pt-6 pb-4">
          {/* Name & specialization */}
          <div>
            <h1 className="text-foreground text-2xl leading-tight font-bold">{specialist.name}</h1>
            {specialist.specialization && (
              <p className="text-muted-foreground mt-1 text-sm">{specialist.specialization}</p>
            )}
          </div>

          {/* Contact row */}
          {(specialist.phone || specialist.telegramHandle) && (
            <div className="flex items-center gap-4">
              {specialist.phone && (
                <a
                  href={`tel:${specialist.phone}`}
                  className="text-muted-foreground flex items-center gap-1.5"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span className="text-xs">{specialist.phone}</span>
                </a>
              )}
              {specialist.telegramHandle && (
                <div className="text-muted-foreground flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span className="text-xs">{specialist.telegramHandle}</span>
                </div>
              )}
            </div>
          )}

          {/* Bio Section */}
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
                  className="text-brand mt-1 text-sm font-medium"
                >
                  {bioExpanded ? t('showLess') : t('showMore')}
                </button>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {(specialist.telegramHandle || specialist.botUsername) && (
              <button
                onClick={handleMessage}
                className="bg-brand flex-1 rounded-[28px] px-4 py-3 text-sm font-medium text-white transition-opacity active:opacity-80"
              >
                {t('messageButton')}
              </button>
            )}
            <button
              onClick={() => router.push('/services')}
              className="bg-surface-hover border-surface-border text-muted-foreground flex-1 rounded-[28px] border px-4 py-3 text-sm font-medium transition-opacity active:opacity-80"
            >
              {t('servicesButton')}
            </button>
            <button
              onClick={handleShare}
              className="bg-surface-hover border-surface-border flex h-12 w-12 items-center justify-center rounded-[28px] border transition-opacity active:opacity-80"
            >
              <Share2 className="text-muted-foreground h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Services Section */}
        {services.length > 0 && (
          <div className="px-4 pb-4">
            <h3 className="text-foreground mb-2 text-sm font-semibold">{t('servicesTitle')}</h3>
            <div className="space-y-2">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="bg-background flex items-center gap-3 rounded-xl p-3"
                >
                  {/* Service thumbnail */}
                  <div className="bg-border flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full">
                    {service.imageUrl ? (
                      <img
                        src={getPhotoUrl(service.imageUrl)}
                        alt={service.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Dumbbell className="text-muted-foreground h-4 w-4" />
                    )}
                  </div>
                  {/* Service info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground text-sm font-medium">{service.name}</p>
                    <div className="mt-0.5 flex items-center gap-1">
                      <Clock className="text-muted-foreground h-3 w-3" />
                      <p className="text-muted-foreground text-xs">
                        {formatDuration(service.durationMinutes, td('hour'))}
                      </p>
                    </div>
                  </div>
                  {service.price > 0 && (
                    <p className="text-foreground ml-2 flex-shrink-0 text-sm font-semibold">
                      {service.price.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')}{' '}
                      {service.currency === 'RUB' ? '\u20BD' : service.currency}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Location Section */}
        {specialist.locationLatitude && specialist.locationLongitude && (
          <div className="px-4 pb-4">
            <h3 className="text-foreground mb-2 text-sm font-semibold">{t('locationTitle')}</h3>
            <a
              href={`https://yandex.ru/maps/?pt=${specialist.locationLongitude},${specialist.locationLatitude}&z=15&l=map`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-background block overflow-hidden rounded-xl"
            >
              <iframe
                src={`https://yandex.ru/map-widget/v1/?ll=${specialist.locationLongitude},${specialist.locationLatitude}&z=15&pt=${specialist.locationLongitude},${specialist.locationLatitude},pm2rdm`}
                width="100%"
                height="200"
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
