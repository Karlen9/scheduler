'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Booking } from '@/lib/types';
import { ClientAvatar } from '@/components/ClientAvatar';

interface NextBookingBannerProps {
  booking: Booking | null;
  onBookingClick?: (booking: Booking) => void;
}

export function NextBookingBanner({ booking, onBookingClick }: NextBookingBannerProps) {
  const router = useRouter();
  const t = useTranslations('NextBookingBanner');
  const tc = useTranslations('Common');
  const tu = useTranslations('TimeUnits');
  const locale = useLocale();

  function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString(locale === 'en' ? 'en-US' : 'ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });
  }

  function getTimeUntil(iso: string): string {
    const now = new Date();
    const start = new Date(iso);
    const diff = start.getTime() - now.getTime();
    if (diff <= 0) return tu('now');
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) {
      const word = minuteWord(minutes);
      return tu('inMinutes', { count: minutes, word });
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      const word = hourWord(hours);
      return tu('inHours', { count: hours, word });
    }
    const days = Math.floor(hours / 24);
    const word = dayWord(days);
    return tu('inDays', { count: days, word });
  }

  function minuteWord(n: number): string {
    if (n % 10 === 1 && n % 100 !== 11) return tu('minute1');
    if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return tu('minute234');
    return tu('minute5');
  }

  function hourWord(n: number): string {
    if (n % 10 === 1 && n % 100 !== 11) return tu('hour1');
    if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return tu('hour234');
    return tu('hour5');
  }

  function dayWord(n: number): string {
    if (n % 10 === 1 && n % 100 !== 11) return tu('day1');
    if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return tu('day234');
    return tu('day5');
  }

  if (!booking) {
    return (
      <div>
        <h2 className="text-foreground mb-3 text-base font-medium">{t('title')}</h2>
        <div className="bg-card border-l-border rounded-xl border-l-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground font-medium">{t('noBookings')}</p>
              <p className="text-muted-foreground/60 mt-0.5 text-sm">{t('noUpcomingSessions')}</p>
            </div>
            <button
              onClick={() => router.push('/admin/book')}
              className="bg-brand flex h-10 w-10 items-center justify-center rounded-full transition-opacity active:opacity-80"
            >
              <Plus className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-foreground mb-3 text-base font-medium">{t('title')}</h2>
      <button
        onClick={() => onBookingClick?.(booking)}
        className="bg-card border-l-brand w-full rounded-xl border-l-4 p-4 text-left transition-opacity active:opacity-80"
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate font-medium">{booking.clientName}</p>
            <p className="text-muted-foreground text-sm">
              {tc('workout')}
              {booking.durationMinutes ? ` \u00b7 ${booking.durationMinutes} ${tc('min')}` : ''}
            </p>
            <p className="text-brand mt-1 text-xs">{getTimeUntil(booking.startsAt)}</p>
            <p className="text-foreground mt-0.5 text-sm">
              {formatTime(booking.startsAt)} – {formatTime(booking.endsAt)}
            </p>
          </div>
          <ClientAvatar name={booking.clientName} photoUrl={booking.clientPhotoUrl} size="lg" />
        </div>
      </button>
    </div>
  );
}
