'use client';

import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PrimaryButton } from '@/components/PrimaryButton';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
}

export function SuccessModal({ isOpen, onClose, title, description }: SuccessModalProps) {
  const tc = useTranslations('Common');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background w-full max-w-sm rounded-2xl p-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center">
            <CheckCircle2 className="text-success h-16 w-16" />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-medium">{title}</h3>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
        <PrimaryButton onClick={onClose}>{tc('great')}</PrimaryButton>
      </div>
    </div>
  );
}
