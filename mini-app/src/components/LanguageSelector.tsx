'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { setLocale } from '@/actions/locale';
import { invalidateProfile, invalidateSpecialist } from '@/hooks/mutations';
import { api } from '@/lib/api';

import type { ReactNode } from 'react';

/***************************************************************************************************
 * Defines the options value used by the component layer.
 *
 * Usage context:
 * - Reused by the component layer to keep shared values centralized.
 ***************************************************************************************************/
const options = [
  { value: 'ru', label: 'RU' },
  { value: 'en', label: 'EN' },
];

/***************************************************************************************************
 * Renders the language selector UI and related interactions.
 *
 * Parameters:
 * - props: Component props that drive rendering and callbacks.
 *
 * Returns:
 * - The computed value for the current operation as ReactNode.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
export function LanguageSelector({ isAdmin }: { isAdmin?: boolean }): ReactNode {
  /***************************************************************************************************
   * Defines the locale value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const locale = useLocale();
  /***************************************************************************************************
   * Defines the router value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const router = useRouter();
  /***************************************************************************************************
   * Defines the te value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const te = useTranslations('Errors');
  const [loading, setLoading] = useState(false);

  /***************************************************************************************************
   * Handles select.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleSelect = async (lang: string): Promise<void> => {
    if (lang === locale || loading) {
      return;
    }
    setLoading(true);
    try {
      if (isAdmin) {
        await api.admin.updateProfile({ language: lang });
      } else {
        await api.updateProfile({ language: lang });
      }
      /***************************************************************************************************
       * Invalidate SWR profile cache BEFORE refresh to prevent cross-device sync from reading
       * stale language and bouncing back.
       ***************************************************************************************************/
      if (isAdmin) {
        invalidateSpecialist();
      } else {
        invalidateProfile();
      }
      await setLocale(lang);
      router.refresh();
    } catch {
      toast.error(te('saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={'bg-card flex gap-1 rounded-lg p-1'}
      style={loading ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type={'button'}
          disabled={loading}
          onClick={async () => handleSelect(opt.value)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            locale === opt.value ? 'bg-brand text-white' : 'text-muted-foreground'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
