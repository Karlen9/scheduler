'use client';

import { X } from 'lucide-react';

import type { TBottomSheetProps } from '@/lib/types';
import type { ReactNode } from 'react';

export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  showClose = true,
  className = '',
}: TBottomSheetProps): ReactNode {
  if (!isOpen) {
    return null;
  }

  return (
    <div className={'fixed inset-0 z-60 flex items-end justify-center'}>
      <div className={'absolute inset-0 bg-black/50'} onClick={onClose} />
      <div
        className={`bg-card animate-slide-up relative w-full rounded-t-2xl p-4 shadow-lg ${className}`}
        style={{ maxWidth: '430px' }}
      >
        {(title || showClose) && (
          <div className={'mb-4 flex items-center justify-between'}>
            {title ? <h3 className={'text-foreground text-lg font-medium'}>{title}</h3> : <div />}
            {showClose && (
              <button onClick={onClose} className={'hover:bg-card rounded-full p-1'}>
                <X className={'text-muted-foreground h-5 w-5'} />
              </button>
            )}
          </div>
        )}
        {children}
        <div className={'h-[env(safe-area-inset-bottom)]'} />
      </div>
    </div>
  );
}
