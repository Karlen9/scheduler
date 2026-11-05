'use client';

import { Moon, Sun } from 'lucide-react';

import { writeThemePreference } from '@/lib/theme';

import type { ReactNode } from 'react';

type TThemeToggleProps = {
  toDarkLabel: string;
  toLightLabel: string;
  withLabel?: boolean;
  className?: string;
};

// Both labels and icons are always rendered and swapped with the `dark:` variant, so the
// server HTML matches the client before the theme script's class is known.
export function ThemeToggle({
  toDarkLabel,
  toLightLabel,
  withLabel = false,
  className = '',
}: TThemeToggleProps): ReactNode {
  const toggle = (): void => {
    const root = document.documentElement;
    const next = root.classList.contains('dark') ? 'light' : 'dark';
    root.classList.toggle('dark', next === 'dark');
    writeThemePreference(next);
  };

  const labelClass = withLabel ? 'text-[0.9375rem] font-semibold' : 'sr-only';

  return (
    <button
      type={'button'}
      onClick={toggle}
      className={`hover:bg-foreground/8 inline-flex min-h-11 items-center justify-center gap-3 rounded-full transition-colors ${withLabel ? 'w-full justify-start px-4' : 'size-11'} ${className}`}
    >
      <Moon aria-hidden={'true'} className={'size-5 shrink-0 dark:hidden'} />
      <Sun aria-hidden={'true'} className={'hidden size-5 shrink-0 dark:block'} />
      <span className={`${labelClass} dark:hidden`}>{toDarkLabel}</span>
      <span className={`${labelClass} hidden dark:inline`}>{toLightLabel}</span>
    </button>
  );
}
