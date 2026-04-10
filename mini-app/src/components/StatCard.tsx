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
  onClick,
}: TStatCardProps): ReactNode {
  const content = (
    <>
      <p className={'text-muted-foreground text-xs'}>{label}</p>
      <div className={'mt-4 flex items-center justify-between pr-6'}>
        <div className={`h-8 w-8 rounded-full ${iconBg} flex items-center justify-center`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <p className={'text-foreground text-2xl font-semibold'}>{value}</p>
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
