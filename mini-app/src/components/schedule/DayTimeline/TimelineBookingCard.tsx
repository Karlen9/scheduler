import { useTranslations } from 'next-intl';
import { Booking } from '@/lib/types';
import { ClientAvatar } from '@/components/ClientAvatar';

interface TimelineBookingCardProps {
  booking: Booking;
  top: number;
  height: number;
  onBookingClick?: (booking: Booking) => void;
  formatTime: (iso: string) => string;
}

function getCardStyle(status: string): { bg: string; text: string; subtext: string } {
  switch (status) {
    case 'confirmed':
      return { bg: 'bg-brand', text: 'text-white', subtext: 'text-white/70' };
    case 'pending':
      return { bg: 'bg-warning', text: 'text-white', subtext: 'text-white/80' };
    default:
      return { bg: 'bg-brand', text: 'text-white', subtext: 'text-white/70' };
  }
}

export function TimelineBookingCard({
  booking,
  top,
  height,
  onBookingClick,
  formatTime,
}: TimelineBookingCardProps) {
  const tc = useTranslations('Common');
  const style = getCardStyle(booking.status);

  return (
    <button
      key={booking.id}
      onClick={() => onBookingClick?.(booking)}
      className={`absolute right-0 left-12 ${style.bg} overflow-hidden rounded-xl px-3 py-2 text-left transition-opacity active:opacity-80`}
      style={{ top: top + 3, height: height - 3 }}
    >
      <div className="flex h-full items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${style.text} truncate`}>
            {booking.clientDisplayName || booking.clientName}
          </p>
          {height >= 54 && (
            <p className={`text-xs ${style.subtext} truncate`}>
              {tc('workout')}
              {booking.durationMinutes ? ` \u00b7 ${booking.durationMinutes} ${tc('min')}` : ''}
            </p>
          )}
          {height >= 68 && (
            <p className={`text-xs ${style.subtext}`}>
              {formatTime(booking.startsAt)} – {formatTime(booking.endsAt)}
            </p>
          )}
        </div>
        <ClientAvatar
          name={booking.clientDisplayName || booking.clientName}
          photoUrl={booking.clientPhotoUrl}
          size="sm"
        />
      </div>
    </button>
  );
}
