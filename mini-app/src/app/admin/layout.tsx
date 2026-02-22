'use client';

import { useEffect } from 'react';

import { AdminLayout } from '@/components/AdminLayout';
import { initTelegramApp } from '@/lib/telegram';

import type { ReactNode } from 'react';

export default function AdminRootLayout({ children }: { children: React.ReactNode }): ReactNode {
  useEffect(() => {
    initTelegramApp();
  }, []);

  return <AdminLayout>{children}</AdminLayout>;
}
