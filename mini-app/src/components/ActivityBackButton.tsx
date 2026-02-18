'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ActivityBackButtonProps {
  href: string;
}

export function ActivityBackButton({ href }: ActivityBackButtonProps) {
  const tc = useTranslations('Common');

  return (
    <div className="px-4 pt-4">
      <Link
        href={href}
        className="text-muted-foreground bg-tab-bar border-tab-bar-border inline-flex items-center gap-1 rounded-full border px-3.5 py-2.5 text-sm transition-transform active:scale-95"
      >
        <ChevronLeft className="h-5 w-5" />
        <span>{tc('back')}</span>
      </Link>
    </div>
  );
}
