'use client';

import { Toaster } from 'sonner';

import type { ReactNode } from 'react';

export function ToastProvider(): ReactNode {
  return (
    <Toaster
      position={'top-center'}
      toastOptions={{
        style: {
          background: 'var(--card)',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
        },
      }}
    />
  );
}
