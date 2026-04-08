'use client';

import { useTranslations } from 'next-intl';

import { ConfirmDialog } from '@/components/ConfirmDialog';

import type { TCancelDialogProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the cancel dialog UI and related interactions.
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
export function CancelDialog({
  isOpen,
  targetName,
  reason,
  onReasonChange,
  onConfirm,
  onClose,
}: TCancelDialogProps): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('AdminDashboard');
  /***************************************************************************************************
   * Defines the tc value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const tc = useTranslations('Common');

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={t('cancelDialog')}
      description={t('cancelDialogDescription', { name: targetName })}
      confirmText={t('cancelConfirm')}
      cancelText={tc('back')}
      onConfirm={onConfirm}
      onClose={onClose}
      destructive
      showInput
      inputPlaceholder={t('cancelReasonPlaceholder')}
      inputValue={reason}
      onInputChange={onReasonChange}
    />
  );
}
