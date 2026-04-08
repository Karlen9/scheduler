import type { TPrimaryButtonProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the primary button UI and related interactions.
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
export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  fullWidth = true,
}: TPrimaryButtonProps): ReactNode {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-6 py-3.5 text-base font-medium transition-opacity ${
        fullWidth ? 'w-full' : ''
      } ${
        disabled
          ? 'bg-primary text-primary-foreground cursor-not-allowed opacity-40'
          : 'bg-primary text-primary-foreground active:opacity-80'
      }`}
    >
      {children}
    </button>
  );
}
