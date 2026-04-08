'use client';

import { useTranslations } from 'next-intl';

import type { TStatusBadgeProps } from '@/lib/types';
import type { ReactNode } from 'react';

const statusColors: Record<string, string> = {
  pending: 'bg-status-pending-bg text-status-pending-text',
  confirmed: 'bg-status-confirmed-bg text-status-confirmed-text',
  rejected: 'bg-status-rejected-bg text-status-rejected-text',
  cancelled: 'bg-status-cancelled-bg text-status-cancelled-text',
  completed: 'bg-status-completed-bg text-status-completed-text',
  cancel_requested: 'bg-status-warning-bg text-status-warning-text',
  reschedule_pending: 'bg-status-purple-bg text-status-purple-text',
  active: 'bg-status-confirmed-bg text-status-confirmed-text',
  declined: 'bg-status-rejected-bg text-status-rejected-text',
};

const statusKeyMap: Record<string, string> = {
  pending: 'pending',
  confirmed: 'confirmed',
  rejected: 'rejected',
  cancelled: 'cancelled',
  completed: 'completed',
  cancel_requested: 'cancelRequested',
  reschedule_pending: 'reschedulePending',
  active: 'active',
  declined: 'declined',
};

export const statusBorders: Record<string, string> = {
  pending: 'border-status-pending-border',
  active: 'border-status-confirmed-border',
  declined: 'border-status-rejected-border',
  cancelled: 'border-status-cancelled-border',
};

/***************************************************************************************************
 * Returns status color.
 *
 * Parameters:
 * - status: Status used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as string.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
export function getStatusColor(status: string): string {
  return statusColors[status] || statusColors.pending;
}

/***************************************************************************************************
 * Renders the status badge UI and related interactions.
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
export function StatusBadge({ status, className = '' }: TStatusBadgeProps): ReactNode {
  /***************************************************************************************************
   * Defines the ts value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const ts = useTranslations('Status');
  /***************************************************************************************************
   * Defines the color value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const color = statusColors[status] || statusColors.pending;
  /***************************************************************************************************
   * Defines the key value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const key = statusKeyMap[status] || 'pending';
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${color} ${className}`}>
      {ts(key)}
    </span>
  );
}
