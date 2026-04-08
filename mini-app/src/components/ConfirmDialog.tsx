'use client';

import { useTranslations } from 'next-intl';

import { PrimaryButton } from '@/components/PrimaryButton';

import type { TConfirmDialogProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the confirm dialog UI and related interactions.
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
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText,
  destructive = false,
  showInput = false,
  inputPlaceholder,
  inputValue,
  onInputChange,
}: TConfirmDialogProps): ReactNode {
  /***************************************************************************************************
   * Defines the tc value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const tc = useTranslations('Common');

  if (!isOpen) {
    return null;
  }

  /***************************************************************************************************
   * Defines the resolved confirm text value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const resolvedConfirmText = confirmText ?? tc('confirm');
  /***************************************************************************************************
   * Defines the resolved cancel text value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const resolvedCancelText = cancelText ?? tc('cancel');

  /***************************************************************************************************
   * Handles confirm.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleConfirm = (): void => {
    onConfirm();
    onClose();
  };

  return (
    <div className={'fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4'}>
      <div className={'bg-card w-full max-w-sm rounded-2xl p-6 shadow-lg'}>
        <h3 className={'text-foreground mb-2 text-lg font-medium'}>{title}</h3>
        {description && <p className={'text-muted-foreground mb-4 text-sm'}>{description}</p>}
        {showInput && (
          <input
            type={'text'}
            value={inputValue || ''}
            onChange={(e) => onInputChange?.(e.target.value)}
            placeholder={inputPlaceholder}
            className={
              'bg-card text-foreground focus:ring-brand mb-4 w-full rounded-lg px-4 py-3 text-sm outline-none focus:ring-2'
            }
          />
        )}
        <div className={'flex gap-3'}>
          <button
            onClick={onClose}
            className={
              'bg-card text-foreground flex-1 rounded-xl px-4 py-3 text-base font-medium transition-opacity active:opacity-70'
            }
          >
            {resolvedCancelText}
          </button>
          {destructive ? (
            <button
              onClick={handleConfirm}
              className={
                'bg-destructive flex-1 rounded-xl px-4 py-3 text-base font-medium text-white transition-opacity active:opacity-70'
              }
            >
              {resolvedConfirmText}
            </button>
          ) : (
            <div className={'flex-1'}>
              <PrimaryButton onClick={handleConfirm}>{resolvedConfirmText}</PrimaryButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
