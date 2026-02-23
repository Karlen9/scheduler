'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import type { TActivityBackButtonProps } from '@/lib/types';
import type { ReactNode } from 'react';

export function ActivityBackButton({ href }: TActivityBackButtonProps): ReactNode {
  const tc = useTranslations('Common');

  return (
    <div className={'px-4 pt-4'}>
      <Link
        href={href}
        className={
          'text-muted-foreground bg-tab-bar border-tab-bar-border inline-flex items-center gap-1 rounded-full border px-3.5 py-2.5 text-sm transition-transform active:scale-95'
        }
      >
        <ChevronLeft className={'h-5 w-5'} />
        <span>{tc('back')}</span>
      </Link>
    </div>
  );
}
