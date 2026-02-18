'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { setLocale } from '@/actions/locale';
import { api } from '@/lib/api';
import { invalidateProfile, invalidateSpecialist } from '@/hooks/mutations';

const options = [
  { value: 'ru', label: 'RU' },
  { value: 'en', label: 'EN' },
];

export function LanguageSelector({ isAdmin }: { isAdmin?: boolean }) {
  const locale = useLocale();
  const router = useRouter();
  const te = useTranslations('Errors');
  const [loading, setLoading] = useState(false);

  const handleSelect = async (lang: string) => {
    if (lang === locale || loading) return;
    setLoading(true);
    try {
      if (isAdmin) {
        await api.admin.updateProfile({ language: lang });
      } else {
        await api.updateProfile({ language: lang });
      }
      // Invalidate SWR profile cache BEFORE refresh to prevent
      // cross-device sync from reading stale language and bouncing back
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
      className="bg-card flex gap-1 rounded-lg p-1"
      style={loading ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={loading}
          onClick={() => handleSelect(opt.value)}
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
