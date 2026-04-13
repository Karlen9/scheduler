'use client';

import { useEffect, useRef } from 'react';
import useSWR from 'swr';

import { api } from '@/lib/api';
import { subscribeMutation } from '@/lib/mutation-events';

import { CACHE_KEYS } from './cache-keys';
import { invalidateChangeGroups, invalidateMutation } from './mutations';

import type { TChangeGroup, TChangeVersions } from '@/lib/types';

const SYNC_REFRESH_INTERVAL_MS = 5000;

function getChangedGroups(previous: TChangeVersions | null, next: TChangeVersions): TChangeGroup[] {
  if (!previous) {
    return [];
  }

  return (Object.keys(next) as TChangeGroup[]).filter(
    (group) => (previous[group] ?? 0) !== (next[group] ?? 0),
  );
}

/***************************************************************************************************
 * Keeps SWR caches synced with local mutations and lightweight backend change versions.
 ***************************************************************************************************/
export function CacheSync(): null {
  const lastVersionsRef = useRef<TChangeVersions | null>(null);

  useEffect(() => {
    return subscribeMutation((event) => {
      void invalidateMutation(event);
    });
  }, []);

  useSWR<TChangeVersions>(CACHE_KEYS.changeVersions, async () => api.getChangeVersions(), {
    refreshInterval: SYNC_REFRESH_INTERVAL_MS,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 4000,
    onSuccess: (versions) => {
      const changedGroups = getChangedGroups(lastVersionsRef.current, versions);
      lastVersionsRef.current = versions;

      if (changedGroups.length > 0) {
        void invalidateChangeGroups(changedGroups);
      }
    },
  });

  return null;
}
