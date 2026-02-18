'use client';

import { Check, X } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { Booking } from '@/lib/types';
import { ClientAvatar } from '@/components/ClientAvatar';

interface PendingBookingCardProps {
  booking: Booking;
  onAccept: (booking: Booking) => void;
  onReject: (booking: Booking) => void;
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

export function PendingBookingCard({ booking, onAccept, onReject }: PendingBookingCardProps) {
  const t = useTranslations('PendingBookingCard');
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
    <div className="bg-card border-l-warning rounded-xl border-l-4 p-4">
      <div className="flex items-start gap-3">
        <ClientAvatar name={booking.clientName} photoUrl={booking.clientPhotoUrl} />
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate font-medium">{booking.clientName}</p>
          <p className="text-muted-foreground text-sm">
            {tc('workout')}
            {booking.durationMinutes
              ? ` · ${booking.durationMinutes} ${tc('min')}`
              : booking.sessionType?.durationMinutes
                ? ` · ${booking.sessionType.durationMinutes} ${tc('min')}`
                : ''}
          </p>
          <p className="text-foreground mt-1 text-sm">
            {formatDate(startsAt)}, {formatTime(startsAt)} – {formatTime(endsAt)}
          </p>
          {booking.clientMessage && (
            <p className="text-muted-foreground mt-1 text-xs italic">
              &ldquo;{booking.clientMessage}&rdquo;
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onAccept(booking)}
          className="bg-action-success-bg text-action-success-text flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-opacity active:opacity-70"
        >
          <Check className="h-4 w-4" />
          {t('accept')}
        </button>
        <button
          onClick={() => onReject(booking)}
          className="bg-action-danger-bg text-action-danger-text flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-opacity active:opacity-70"
        >
          <X className="h-4 w-4" />
          {t('reject')}
        </button>
      </div>
    </div>
  );
}
