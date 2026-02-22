'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import type { ReactNode } from 'react';

export default function AdminBookingsRedirect(): ReactNode {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin');
  }, [router]);
  return null;
}
