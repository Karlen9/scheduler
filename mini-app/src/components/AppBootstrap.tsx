'use client';

import { useEffect } from 'react';

import { initTelegramApp } from '@/lib/telegram';

/***************************************************************************************************
 * Initializes shared client-side app integrations once per app lifetime.
 *
 * Returns:
 * - null.
 ***************************************************************************************************/
export function AppBootstrap(): null {
  useEffect(() => {
    initTelegramApp();
  }, []);

  return null;
}
