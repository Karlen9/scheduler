'use client';

import { useTranslations } from 'next-intl';

import { ConfirmDialog } from '@/components/ConfirmDialog';

import type { TVoidFunction } from '@/lib/types';
import type { ReactNode } from 'react';

type TCancelDialogProps = {
  isOpen: boolean;
  targetName: string;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: TVoidFunction;
  onClose: TVoidFunction;
};

export function CancelDialog({
  isOpen,
  targetName,
  reason,
  onReasonChange,
  onConfirm,
  onClose,
}: TCancelDialogProps): ReactNode {
  const t = useTranslations('AdminDashboard');
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
