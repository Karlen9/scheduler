'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { ClientSelector } from '@/components/BookingForm/ClientSelector';
import { invalidateClients } from '@/hooks/mutations';
import { useClients } from '@/hooks/queries';
import { api } from '@/lib/api';
import { resolveTestAwareHref } from '@/lib/routes';

import type { TClientInfo } from '@/lib/types';
import type { ReactNode } from 'react';

function buildBookHref(pathname: string, searchParams: URLSearchParams, clientId: string): string {
  const params = new URLSearchParams(searchParams);
  params.set('clientId', clientId);
  const base = resolveTestAwareHref(pathname, '/admin/choose-client/book');
  return `${base}?${params.toString()}`;
}

export default function AdminChooseClientPage(): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('BookingForm');
  const { data: clients } = useClients();

  const goToBooking = useCallback(
    (client: TClientInfo): void => {
      router.push(buildBookHref(pathname, new URLSearchParams(searchParams.toString()), client.id));
    },
    [pathname, router, searchParams],
  );

  const handleCreateGhost = useCallback(async (name: string): Promise<TClientInfo> => {
    const client = await api.admin.createGhostClient(name);
    invalidateClients();
    return client;
  }, []);

  return (
    <div className={'flex flex-col p-4 pb-32'}>
      <h2 className={'mb-4 px-1 text-lg font-semibold'}>{t('selectClient')}</h2>
      <ClientSelector
        clients={clients}
        selectedClient={null}
        setSelectedClient={(value) => {
          const next = typeof value === 'function' ? value(null) : value;
          if (next) {
            goToBooking(next);
          }
        }}
        onCreateGhostClient={handleCreateGhost}
      />
    </div>
  );
}
