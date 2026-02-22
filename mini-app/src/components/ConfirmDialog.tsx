'use client';

import { useTranslations } from 'next-intl';

import { PrimaryButton } from '@/components/PrimaryButton';

import type { TVoidFunction } from '@/lib/types';
import type { ReactNode } from 'react';

type TConfirmDialogProps = {
  isOpen: boolean;
  onClose: TVoidFunction;
  onConfirm: TVoidFunction;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  showInput?: boolean;
  inputPlaceholder?: string;
  inputValue?: string;
  onInputChange?: (value: string) => void;
};

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
  const tc = useTranslations('Common');

  if (!isOpen) {
    return null;
  }

  const resolvedConfirmText = confirmText ?? tc('confirm');
  const resolvedCancelText = cancelText ?? tc('cancel');

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
