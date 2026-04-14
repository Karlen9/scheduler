'use client';

import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { X } from 'lucide-react';
import { Fragment, useRef } from 'react';

import type { TBottomSheetProps } from '@/lib/types';
import type { ReactNode } from 'react';

type TBottomSheetContent = Pick<
  TBottomSheetProps,
  'children' | 'title' | 'showClose' | 'className'
>;

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
  const currentContent = { children, title, showClose, className };
  const retainedContentRef = useRef<TBottomSheetContent>(currentContent);
  if (isOpen) {
    retainedContentRef.current = currentContent;
  }

  const content = isOpen ? currentContent : retainedContentRef.current;

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
        <div className={'fixed inset-0 flex items-end justify-center overscroll-contain'}>
          <TransitionChild
            as={Fragment}
            enter={'ease-out duration-300'}
            enterFrom={'translate-y-full opacity-0'}
            enterTo={'translate-y-0 opacity-100'}
            leave={'ease-in duration-200'}
            leaveFrom={'translate-y-0 opacity-100'}
            leaveTo={'translate-y-full opacity-0'}
          >
            <DialogPanel
              className={`bg-card relative max-h-[100dvh] w-full overflow-auto rounded-t-2xl p-4 shadow-lg ${content.className ?? ''}`}
              style={{ maxWidth: '430px' }}
            >
              {(content.title || content.showClose) && (
                <div className={'mb-4 flex items-center justify-between'}>
                  {content.title ? (
                    <DialogTitle className={'text-foreground text-lg font-medium'}>
                      {content.title}
                    </DialogTitle>
                  ) : (
                    <div />
                  )}
                  {content.showClose && (
                    <button onClick={onClose} className={'hover:bg-card rounded-full p-1'}>
                      <X className={'text-muted-foreground h-5 w-5'} />
                    </button>
                  )}
                </div>
              )}
              {content.children}
              <div className={'h-[env(safe-area-inset-bottom)]'} />
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
