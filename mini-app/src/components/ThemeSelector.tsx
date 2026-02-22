'use client';

import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { applyTheme, getThemePreference, setThemePreference } from '@/lib/telegram';

import type { TThemePreference } from '@/lib/telegram';
import type { ReactNode } from 'react';

export function ThemeSelector(): ReactNode {
  const t = useTranslations('ThemeSelector');
  const [current, setCurrent] = useState<TThemePreference>(getThemePreference);

  const options: { value: TThemePreference; label: string; icon?: typeof Sun }[] = [
    { value: 'auto', label: t('auto') },
    { value: 'light', label: t('light'), icon: Sun },
    { value: 'dark', label: t('dark'), icon: Moon },
  ];

  const handleSelect = (pref: TThemePreference): void => {
    setCurrent(pref);
    setThemePreference(pref);
    applyTheme();
  };

  return (
    <div className={'bg-card flex gap-1 rounded-lg p-1'}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type={'button'}
          onClick={() => handleSelect(opt.value)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            current === opt.value ? 'bg-brand text-white' : 'text-muted-foreground'
          }`}
        >
          {opt.icon && <opt.icon className={'h-4 w-4'} />}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
