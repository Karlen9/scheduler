'use client';

import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { useTranslations } from 'next-intl';
import { Fragment, useEffect, useState } from 'react';

import { PrimaryButton } from '@/components/PrimaryButton';

import type { TConfirmDialogProps } from '@/lib/types';
import type { ReactNode } from 'react';

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
}: TConfirmDialogProps): ReactNode {
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
                {content.destructive ? (
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
