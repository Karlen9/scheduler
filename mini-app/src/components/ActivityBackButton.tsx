'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { resolveTestAwareHref } from '@/lib/routes';

import type { TActivityBackButtonProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the activity back button UI and related interactions.
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
export function ActivityBackButton({ href }: TActivityBackButtonProps): ReactNode {
  /***************************************************************************************************
   * Defines the tc value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const tc = useTranslations('Common');
  const pathname = usePathname();
  const resolvedHref = resolveTestAwareHref(pathname, href);

  return (
    <div className={'px-4 pt-4'}>
      <Link
        href={resolvedHref}
        className={
          'text-muted-foreground bg-tab-bar border-tab-bar-border inline-flex items-center gap-1 rounded-full border px-3.5 py-2.5 text-sm transition-transform active:scale-95'
        }
      >
        <ChevronLeft className={'h-5 w-5'} />
        <span>{tc('back')}</span>
      </Link>
    </div>
  );
}
