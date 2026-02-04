"use client";

import { ChevronRight, LucideIcon } from "lucide-react";
import Link from "next/link";

interface SettingsMenuItemProps {
  icon: LucideIcon;
  label: string;
  href: string;
}

export function SettingsMenuItem({ icon: Icon, label, href }: SettingsMenuItemProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 px-4 py-4 border-b border-[var(--app-divider)] transition-colors active:bg-[var(--app-surface)]"
    >
      <Icon className="w-5 h-5 text-[var(--app-text)]" />
      <span className="flex-1 text-[var(--app-text)]">{label}</span>
      <ChevronRight className="w-5 h-5 text-[var(--app-subtext)]" />
    </Link>
  );
}
