'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Booking } from '@/lib/types';
import { ClientAvatar } from '@/components/ClientAvatar';

interface UpcomingBookingCardProps {
  booking: Booking;
  onClick?: (booking: Booking) => void;
}

const monthShortKeys = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];
const dayShortKeysJS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function UpcomingBookingCard({ booking, onClick }: UpcomingBookingCardProps) {
  const tc = useTranslations('Common');
  const td = useTranslations('Dates');
  const locale = useLocale();

  const startsAt = new Date(booking.startsAt);
  const endsAt = new Date(booking.endsAt);

  function formatDate(date: Date): string {
    const dayKey = dayShortKeysJS[date.getUTCDay()];
    const monthKey = monthShortKeys[date.getUTCMonth()];
    return `${td(`daysShort.${dayKey}`)}, ${date.getUTCDate()} ${td(`monthsShort.${monthKey}`)}`;
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString(locale === 'en' ? 'en-US' : 'ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });
  }

  return (
    <button
      onClick={() => onClick?.(booking)}
      className="bg-card border-l-status-confirmed-border w-full rounded-xl border-l-4 p-4 text-left transition-opacity active:opacity-80"
    >
      <div className="flex items-center gap-3">
        <ClientAvatar
          name={booking.clientDisplayName || booking.clientName}
          photoUrl={booking.clientPhotoUrl}
        />
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate font-medium">
            {booking.clientDisplayName || booking.clientName}
          </p>
          <p className="text-muted-foreground text-sm">
            {tc('workout')}
            {booking.durationMinutes
              ? ` · ${booking.durationMinutes} ${tc('min')}`
              : booking.sessionType?.durationMinutes
                ? ` · ${booking.sessionType.durationMinutes} ${tc('min')}`
                : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-foreground text-sm font-medium">
            {formatTime(startsAt)} – {formatTime(endsAt)}
          </p>
          <p className="text-muted-foreground text-xs">{formatDate(startsAt)}</p>
        </div>
      </div>
    </button>
  );
}
