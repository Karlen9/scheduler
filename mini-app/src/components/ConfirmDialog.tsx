'use client';

import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { useTranslations } from 'next-intl';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';

import { PrimaryButton } from '@/components/PrimaryButton';
import { getTelegramWebApp } from '@/lib/telegram';

import type { TConfirmDialogProps } from '@/lib/types';
import type { ReactNode, PointerEvent as ReactPointerEvent } from 'react';

type TConfirmDialogContent = Pick<
  TConfirmDialogProps,
  | 'title'
  | 'description'
  | 'confirmText'
  | 'cancelText'
  | 'destructive'
  | 'showInput'
  | 'inputPlaceholder'
  | 'inputValue'
  | 'confirmDisabled'
>;

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
  confirmDisabled = false,
  children,
  holdToConfirm = false,
  holdDurationMs = 2000,
}: TConfirmDialogProps): ReactNode {
  const [holding, setHolding] = useState(false);
  const holdTimerRef = useRef<number | null>(null);

  const clearHoldTimer = useCallback((): void => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const cancelHold = useCallback((): void => {
    clearHoldTimer();
    setHolding(false);
  }, [clearHoldTimer]);

  useEffect(() => {
    if (!isOpen) {
      cancelHold();
    }
  }, [isOpen, cancelHold]);

  useEffect(() => clearHoldTimer, [clearHoldTimer]);
  /***************************************************************************************************
   * Defines the tc value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const tc = useTranslations('Common');
  const [retainedContent, setRetainedContent] = useState<TConfirmDialogContent>({
    title,
    description,
    confirmText,
    cancelText,
    destructive,
    showInput,
    inputPlaceholder,
    inputValue,
    confirmDisabled,
  });

  useEffect(() => {
    if (isOpen) {
      setRetainedContent({
        title,
        description,
        confirmText,
        cancelText,
        destructive,
        showInput,
        inputPlaceholder,
        inputValue,
        confirmDisabled,
      });
    }
  }, [
    cancelText,
    confirmText,
    confirmDisabled,
    description,
    destructive,
    inputPlaceholder,
    inputValue,
    isOpen,
    showInput,
    title,
  ]);

  const content = isOpen
    ? {
        title,
        description,
        confirmText,
        cancelText,
        destructive,
        showInput,
        inputPlaceholder,
        inputValue,
        confirmDisabled,
      }
    : retainedContent;

  /***************************************************************************************************
   * Defines the resolved confirm text value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const resolvedConfirmText = content.confirmText ?? tc('confirm');
  /***************************************************************************************************
   * Defines the resolved cancel text value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const resolvedCancelText = content.cancelText ?? tc('cancel');

  /***************************************************************************************************
   * Handles confirm.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleConfirm = (): void => {
    if (content.confirmDisabled) {
      return;
    }

    onConfirm();
    onClose();
  };

  /***************************************************************************************************
   * Hold-to-confirm handlers. Pointer events cover touch + mouse on modern browsers. The fill
   * element animates from 0% → 100% width via CSS transition while holding; on release (or leave
   * or cancel) we snap back instantly by zeroing out the transition duration.
   ***************************************************************************************************/
  const holdFillStyle = {
    width: holding ? '100%' : '0%',
    transitionDuration: holding ? `${holdDurationMs}ms` : '0ms',
    transitionTimingFunction: 'linear' as const,
    transitionProperty: 'width',
  };

  const handleHoldStart = (e: ReactPointerEvent<HTMLButtonElement>): void => {
    if (content.confirmDisabled) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    getTelegramWebApp()?.HapticFeedback?.impactOccurred?.('medium');
    setHolding(true);
    clearHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      setHolding(false);
      getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.('success');
      onConfirm();
      onClose();
    }, holdDurationMs);
  };

  const handleHoldEnd = (e: ReactPointerEvent<HTMLButtonElement>): void => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    cancelHold();
  };

  return (
    <Transition show={isOpen} appear as={Fragment}>
      <Dialog onClose={onClose} className={'relative z-[100]'}>
        <TransitionChild
          as={Fragment}
          enter={'ease-out duration-200'}
          enterFrom={'opacity-0'}
          enterTo={'opacity-100'}
          leave={'ease-in duration-150'}
          leaveFrom={'opacity-100'}
          leaveTo={'opacity-0'}
        >
          <div className={'fixed inset-0 bg-black/50'} aria-hidden={'true'} />
        </TransitionChild>
        <div className={'fixed inset-0 flex items-center justify-center p-4'}>
          <TransitionChild
            as={Fragment}
            enter={'ease-out duration-200'}
            enterFrom={'scale-95 opacity-0'}
            enterTo={'scale-100 opacity-100'}
            leave={'ease-in duration-150'}
            leaveFrom={'scale-100 opacity-100'}
            leaveTo={'scale-95 opacity-0'}
          >
            <DialogPanel className={'bg-card w-full max-w-sm rounded-2xl p-6 shadow-lg'}>
              <DialogTitle className={'text-foreground mb-2 text-lg font-medium'}>
                {content.title}
              </DialogTitle>
              {content.description && (
                <p className={'text-muted-foreground mb-4 text-sm'}>{content.description}</p>
              )}
              {content.showInput && (
                <input
                  type={'text'}
                  value={content.inputValue || ''}
                  onChange={(e) => onInputChange?.(e.target.value)}
                  placeholder={content.inputPlaceholder}
                  className={
                    'bg-card text-foreground focus:ring-brand mb-4 w-full rounded-lg px-4 py-3 text-sm outline-none focus:ring-2'
                  }
                />
              )}
              {children}
              <div className={'flex gap-3'}>
                <button
                  onClick={onClose}
                  className={
                    'bg-card text-foreground flex-1 rounded-xl px-4 py-3 text-base font-medium transition-opacity active:opacity-70'
                  }
                >
                  {resolvedCancelText}
                </button>
                {content.destructive && holdToConfirm ? (
                  <button
                    type={'button'}
                    onPointerDown={handleHoldStart}
                    onPointerUp={handleHoldEnd}
                    onPointerLeave={handleHoldEnd}
                    onPointerCancel={handleHoldEnd}
                    disabled={content.confirmDisabled}
                    className={
                      'bg-destructive relative flex-1 touch-none overflow-hidden rounded-xl px-4 py-3 text-base font-medium text-white transition-opacity select-none disabled:cursor-not-allowed disabled:opacity-40'
                    }
                    aria-label={resolvedConfirmText}
                  >
                    <span
                      aria-hidden={'true'}
                      className={'pointer-events-none absolute inset-y-0 left-0 bg-white/25'}
                      style={holdFillStyle}
                    />
                    <span className={'relative'}>{resolvedConfirmText}</span>
                  </button>
                ) : content.destructive ? (
                  <button
                    onClick={handleConfirm}
                    disabled={content.confirmDisabled}
                    className={
                      'bg-destructive flex-1 rounded-xl px-4 py-3 text-base font-medium text-white transition-opacity active:opacity-70 disabled:cursor-not-allowed disabled:opacity-40'
                    }
                  >
                    {resolvedConfirmText}
                  </button>
                ) : (
                  <div className={'flex-1'}>
                    <PrimaryButton onClick={handleConfirm} disabled={content.confirmDisabled}>
                      {resolvedConfirmText}
                    </PrimaryButton>
                  </div>
                )}
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
