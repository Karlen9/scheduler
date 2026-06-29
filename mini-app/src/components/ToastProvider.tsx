'use client';

import { Toaster } from 'sonner';

import type { ReactNode } from 'react';

export function ToastProvider(): ReactNode {
  return <Toaster position={'top-center'} />;
}
