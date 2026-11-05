'use client';

import { Menu, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import type { ReactNode } from 'react';

type TMobileMenuProps = {
  openLabel: string;
  closeLabel: string;
  children: ReactNode;
};

export function MobileMenu({ openLabel, closeLabel, children }: TMobileMenuProps): ReactNode {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type={'button'}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? closeLabel : openLabel}
        onClick={() => setOpen((value) => !value)}
        className={
          'hover:bg-foreground/8 inline-flex size-11 items-center justify-center rounded-full transition-colors lg:hidden'
        }
      >
        {open ? (
          <X aria-hidden={'true'} className={'size-5'} />
        ) : (
          <Menu aria-hidden={'true'} className={'size-5'} />
        )}
      </button>
      <div
        ref={panelRef}
        id={panelId}
        hidden={!open}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('a')) {
            setOpen(false);
          }
        }}
        className={
          'bg-card animate-fade-in absolute inset-x-0 top-full z-50 mt-2 rounded-3xl p-3 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.4),0_0_0_1px_var(--hairline)] lg:hidden'
        }
      >
        {children}
      </div>
    </>
  );
}
