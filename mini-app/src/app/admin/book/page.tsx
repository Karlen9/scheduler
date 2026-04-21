'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { resolveTestAwareHref } from '@/lib/routes';

import type { ReactNode } from 'react';

export default function AdminBookLegacyRedirectPage(): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const base = resolveTestAwareHref(pathname, '/admin/choose-client');
    const query = searchParams.toString();
    router.replace(query ? `${base}?${query}` : base);
  }, [pathname, router, searchParams]);

  return null;
}
