import type { TStatCardProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the stat card UI and related interactions.
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
export function StatCard({
  icon: Icon,
  iconColor,
  iconBg,
  value,
  label,
  valueSize = '2xl',
  animated,
  onClick,
}: TStatCardProps): ReactNode {
  const valueSizeClass = {
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
  }[valueSize];

  const content = (
    <>
      <p className={'text-muted-foreground text-xs'}>{label}</p>
      <div className={'mt-4 flex items-center justify-between'}>
        <div className={`relative h-8 w-8 rounded-full ${iconBg} flex items-center justify-center`}>
          {animated && (
            <span
              className={`absolute inset-0 rounded-full ${iconBg}`}
              style={{ animation: 'ping-wave 2s cubic-bezier(0, 0, 0.2, 1) infinite' }}
            />
          )}
          <Icon
            className={`relative h-4 w-4 ${iconColor} ${animated ? 'animate-bell-ring' : ''}`}
          />
        </div>
        <p className={`text-foreground whitespace-nowrap ${valueSizeClass} font-semibold`}>
          {value}
        </p>
      </div>
    </>
  );

  if (!onClick) {
    return <div className={'bg-card rounded-xl p-4 text-left'}>{content}</div>;
  }

  return (
    <button type={'button'} onClick={onClick} className={'bg-card rounded-xl p-4 text-left'}>
      {content}
    </button>
  );
}
