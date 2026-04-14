'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { useTelegramBackHandler } from '@/components/TelegramBackButtonProvider';

import type { TTopBarProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the top bar UI and related interactions.
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
export function TopBar({ title, showBack = false, onBack }: TTopBarProps): ReactNode {
  /***************************************************************************************************
   * Defines the router value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const router = useRouter();

  /***************************************************************************************************
   * Handles back.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleBack = useCallback((): void => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  }, [onBack, router]);

  useTelegramBackHandler(showBack ? handleBack : null);

  return (
    <div
      className={
        'bg-background border-border sticky top-0 z-10 flex h-14 items-center border-b px-4'
      }
    >
      <h1 className={'text-foreground flex-1 text-lg font-medium'}>{title}</h1>
    </div>
  );
}
