'use client';

import { useTranslations } from 'next-intl';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface CancelDialogProps {
  isOpen: boolean;
  targetName: string;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function CancelDialog({
  isOpen,
  targetName,
  reason,
  onReasonChange,
  onConfirm,
  onClose,
}: CancelDialogProps) {
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
