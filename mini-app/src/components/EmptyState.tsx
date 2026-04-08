import type { TEmptyStateProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the empty state UI and related interactions.
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
export function EmptyState({ icon, title, description, action }: TEmptyStateProps): ReactNode {
  return (
    <div className={'flex flex-col items-center justify-center px-8 py-16 text-center'}>
      <div className={'text-muted-foreground mb-4 flex h-16 w-16 items-center justify-center'}>
        {icon}
      </div>
      <h3 className={'text-foreground mb-2 text-lg font-medium'}>{title}</h3>
      {description && (
        <p className={'text-muted-foreground mb-6 max-w-xs text-sm'}>{description}</p>
      )}
      {action && <div className={'w-full max-w-xs'}>{action}</div>}
    </div>
  );
}
