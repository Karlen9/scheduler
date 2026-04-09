import { useTranslations } from 'next-intl';
import { memo } from 'react';

import { ClientAvatar } from '@/components/ClientAvatar';

import type { TTimelineBookingCardProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Returns card style.
 *
 * Parameters:
 * - status: Status used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as .
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
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

/***************************************************************************************************
 * Renders the timeline booking card UI and related interactions.
 *
 * Parameters:
 * - props: Component props that drive rendering and callbacks.
 *
 * Returns:
 * - The computed value for the current operation as ReactNode.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
function TimelineBookingCardComponent({
  booking,
  top,
  height,
  onBookingClick,
  formatTime,
}: TTimelineBookingCardProps): ReactNode {
  /***************************************************************************************************
   * Defines the tc value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const tc = useTranslations('Common');
  /***************************************************************************************************
   * Defines the style value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const style = getCardStyle(booking.status);

  return (
    <button
      key={booking.id}
      onClick={() => onBookingClick?.(booking)}
      className={`absolute right-0 left-12 ${style.bg} overflow-hidden rounded-xl px-3 py-2 text-left transition-opacity active:opacity-80`}
      style={{ top: top + 3, height: height - 3 }}
    >
      <div className={'flex h-full items-center gap-2'}>
        <div className={'min-w-0 flex-1'}>
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
              {formatTime(booking.startsAt)}
              {' – '}
              {formatTime(booking.endsAt)}
            </p>
          )}
        </div>
        <ClientAvatar
          name={booking.clientDisplayName || booking.clientName}
          photoUrl={booking.clientPhotoUrl}
          size={'sm'}
        />
      </div>
    </button>
  );
}

export const TimelineBookingCard = memo(TimelineBookingCardComponent);
