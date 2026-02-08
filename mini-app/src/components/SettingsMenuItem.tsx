"use client";

import { ChevronRight, LucideIcon } from "lucide-react";
import Link from "next/link";

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
  iconColor = "bg-brand",
}: SettingsMenuItemProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-surface-hover"
    >
      <div
        className={`w-8 h-8 rounded-lg ${iconColor} flex items-center justify-center flex-shrink-0`}
      >
        <Icon className="w-[18px] h-[18px] text-white" />
      </div>
      <span className="flex-1 text-[15px] text-foreground">{label}</span>
      {value && (
        <span className="text-[15px] text-muted-foreground mr-1">{value}</span>
      )}
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
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
      {title && (
        <h3 className="text-sm font-medium text-muted-foreground px-4 mb-2">
          {title}
        </h3>
      )}
      <div className="bg-card rounded-xl overflow-hidden divide-y divide-border">
        {children}
      </div>
    </div>
  );
}
