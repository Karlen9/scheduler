'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { resolveTestAwareHref } from '@/lib/routes';

import type { TSettingsGroupProps, TSettingsMenuItemProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the settings menu item UI and related interactions.
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
export function SettingsMenuItem({
  icon: Icon,
  label,
  value,
  subtitle,
  href,
  iconColor = 'bg-brand',
}: TSettingsMenuItemProps): ReactNode {
  const pathname = usePathname();
  const resolvedHref = resolveTestAwareHref(pathname, href);

  return (
    <Link
      href={resolvedHref}
      className={'active:bg-surface-hover flex items-center gap-3 px-4 py-3.5 transition-colors'}
    >
      <div className={`h-8 w-8 rounded-lg ${iconColor} flex shrink-0 items-center justify-center`}>
        <Icon className={'h-[18px] w-[18px] text-white'} />
      </div>
      {subtitle ? (
        <div className={'min-w-0 flex-1'}>
          <span className={'text-foreground block text-[15px]'}>{label}</span>
          <span className={'text-muted-foreground block truncate text-xs'}>{subtitle}</span>
        </div>
      ) : (
        <span className={'text-foreground flex-1 text-[15px]'}>{label}</span>
      )}
      {value && <span className={'text-muted-foreground mr-1 text-[15px]'}>{value}</span>}
      <ChevronRight className={'text-muted-foreground h-4 w-4 shrink-0'} />
    </Link>
  );
}

/***************************************************************************************************
 * Renders the settings group UI and related interactions.
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
export function SettingsGroup({ title, children }: TSettingsGroupProps): ReactNode {
  return (
    <div className={'mb-4'}>
      {title && <h3 className={'text-muted-foreground mb-2 px-4 text-sm font-medium'}>{title}</h3>}
      <div className={'bg-card divide-border divide-y overflow-hidden rounded-xl'}>{children}</div>
    </div>
  );
}
