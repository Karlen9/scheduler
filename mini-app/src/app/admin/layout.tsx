'use client';

import { useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { initTelegramApp } from '@/lib/telegram';

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initTelegramApp();
  }, []);

  return <AdminLayout>{children}</AdminLayout>;
}
