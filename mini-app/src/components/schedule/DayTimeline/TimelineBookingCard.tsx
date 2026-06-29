import { useTranslations } from 'next-intl';
import { memo } from 'react';

import { ClientAvatar } from '@/components/ClientAvatar';
import { clientEntityLabel } from '@/lib/helpers';

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

function getBookingDuration(booking: TTimelineBookingCardProps['booking']): number {
  if (booking.durationMinutes) {
    return booking.durationMinutes;
  }
  if (booking.sessionType?.durationMinutes) {
    return booking.sessionType.durationMinutes;
  }
  const start = new Date(booking.startsAt).getTime();
  const end = new Date(booking.endsAt).getTime();
  return Math.max(0, Math.round((end - start) / 60000));
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
  const compact = height < 50;
  const serviceName = booking.sessionType?.name || tc('workout');
  const duration = getBookingDuration(booking);
  const durationLabel = duration ? `${duration} ${tc('min')}` : '';
  const timeRange = `${formatTime(booking.startsAt)} - ${formatTime(booking.endsAt)}`;

  return (
    <button
      key={booking.id}
      onClick={() => onBookingClick?.(booking)}
      className={`ring-background absolute right-0 left-12 overflow-hidden text-left ring-1 transition-opacity active:opacity-80 ${style.bg} ${
        compact ? 'rounded-lg px-2 py-1' : 'rounded-xl px-3 py-1.5'
      }`}
      style={{ top: top + 3, height: height - 3 }}
    >
      {compact ? (
        <div className={'flex h-full min-w-0 items-center gap-2'}>
          <p className={`min-w-0 flex-1 truncate text-xs font-medium ${style.text}`}>
            {clientEntityLabel(booking, tc('self'))}
          </p>
          <span className={`shrink-0 text-[10px] leading-none ${style.subtext}`}>
            {formatTime(booking.startsAt)}
          </span>
        </div>
      ) : (
        <div className={'flex h-full items-center gap-2'}>
          <div className={'min-w-0 flex-1'}>
            <div className={'flex min-w-0 items-center gap-2'}>
              <p className={`min-w-0 flex-1 truncate text-sm font-medium ${style.text}`}>
                {clientEntityLabel(booking, tc('self'))}
              </p>
              <span
                className={`shrink-0 rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] leading-none ${style.text}`}
              >
                {formatTime(booking.startsAt)}
              </span>
            </div>
            {height >= 54 && (
              <div className={`flex min-w-0 items-center gap-1 text-xs ${style.subtext}`}>
                <span className={'min-w-0 truncate'}>{serviceName}</span>
                {durationLabel && <span className={'shrink-0'}>{durationLabel}</span>}
              </div>
            )}
            {height >= 68 && <p className={`truncate text-xs ${style.subtext}`}>{timeRange}</p>}
          </div>
          {height >= 54 && (
            <ClientAvatar
              name={booking.clientDisplayName || booking.clientName}
              photoUrl={booking.clientPhotoUrl}
              size={'sm'}
              isSelf={booking.clientIsSelf}
            />
          )}
        </div>
      )}
    </button>
  );
}

export const TimelineBookingCard = memo(TimelineBookingCardComponent);
