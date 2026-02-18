'use client';

import { ChevronRight, LucideIcon } from 'lucide-react';
import Link from 'next/link';

interface SettingsMenuItemProps {
  icon: LucideIcon;
  label: string;
  value?: string;
  href: string;
  iconColor?: string;
}

export function SettingsMenuItem({
  icon: Icon,
  label,
  value,
  href,
  iconColor = 'bg-brand',
}: SettingsMenuItemProps) {
  return (
    <Link
      href={href}
      className="active:bg-surface-hover flex items-center gap-3 px-4 py-3.5 transition-colors"
    >
      <div
        className={`h-8 w-8 rounded-lg ${iconColor} flex flex-shrink-0 items-center justify-center`}
      >
        <Icon className="h-[18px] w-[18px] text-white" />
      </div>
      <span className="text-foreground flex-1 text-[15px]">{label}</span>
      {value && <span className="text-muted-foreground mr-1 text-[15px]">{value}</span>}
      <ChevronRight className="text-muted-foreground h-4 w-4 flex-shrink-0" />
    </Link>
  );
}

interface SettingsGroupProps {
  title?: string;
  children: React.ReactNode;
}

export function SettingsGroup({ title, children }: SettingsGroupProps) {
  return (
    <div className="mb-4">
      {title && <h3 className="text-muted-foreground mb-2 px-4 text-sm font-medium">{title}</h3>}
      <div className="bg-card divide-border divide-y overflow-hidden rounded-xl">{children}</div>
    </div>
  );
}
