'use client';

import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { X } from 'lucide-react';

import type { TBottomSheetProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the bottom sheet UI and related interactions.
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
    <Dialog open={isOpen} onClose={onClose} className={'relative z-[100]'}>
      <div className={'fixed inset-0 bg-black/50'} aria-hidden={'true'} />
      <div className={'fixed inset-0 flex items-end justify-center overscroll-contain'}>
        <DialogPanel
          className={`bg-card animate-slide-up relative max-h-[100dvh] w-full overflow-auto rounded-t-2xl p-4 shadow-lg ${className}`}
          style={{ maxWidth: '430px' }}
        >
          {(title || showClose) && (
            <div className={'mb-4 flex items-center justify-between'}>
              {title ? (
                <DialogTitle className={'text-foreground text-lg font-medium'}>{title}</DialogTitle>
              ) : (
                <div />
              )}
              {showClose && (
                <button onClick={onClose} className={'hover:bg-card rounded-full p-1'}>
                  <X className={'text-muted-foreground h-5 w-5'} />
                </button>
              )}
            </div>
          )}
          {children}
          <div className={'h-[env(safe-area-inset-bottom)]'} />
        </DialogPanel>
      </div>
    </Dialog>
  );
}
