'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import type { TTopBarProps } from '@/lib/types';
import type { ReactNode } from 'react';

export function TopBar({ title, showBack = false, onBack }: TTopBarProps): ReactNode {
  const router = useRouter();
  const tc = useTranslations('Common');

  const handleBack = (): void => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <div
      className={
        'bg-background border-border sticky top-0 z-10 flex h-14 items-center border-b px-4'
      }
    >
      {showBack && (
        <button
          onClick={handleBack}
          className={'mr-1 -ml-2 flex h-10 w-10 items-center justify-center'}
          aria-label={tc('back')}
        >
          <ArrowLeft className={'text-foreground h-6 w-6'} />
        </button>
      )}
      <h1 className={'text-foreground flex-1 text-lg font-medium'}>{title}</h1>
    </div>
  );
}
