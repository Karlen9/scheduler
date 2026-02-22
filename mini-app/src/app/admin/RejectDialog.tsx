'use client';

import { useTranslations } from 'next-intl';

import { ConfirmDialog } from '@/components/ConfirmDialog';

import type { TVoidFunction } from '@/lib/types';
import type { ReactNode } from 'react';

type TRejectDialogProps = {
  isOpen: boolean;
  targetName: string;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: TVoidFunction;
  onClose: TVoidFunction;
};

export function RejectDialog({
  isOpen,
  targetName,
  reason,
  onReasonChange,
  onConfirm,
  onClose,
}: TRejectDialogProps): ReactNode {
  const t = useTranslations('AdminDashboard');
  const tc = useTranslations('Common');

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={t('rejectDialog')}
      description={t('rejectDialogDescription', { name: targetName })}
      confirmText={t('rejectConfirm')}
      cancelText={tc('back')}
      onConfirm={onConfirm}
      onClose={onClose}
      destructive
      showInput
      inputPlaceholder={t('rejectReasonPlaceholder')}
      inputValue={reason}
      onInputChange={onReasonChange}
    />
  );
}
