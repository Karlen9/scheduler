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
      className="flex items-center gap-4 px-4 py-4 border-b border-border transition-colors active:bg-card"
    >
      <Icon className="w-5 h-5 text-foreground" />
      <span className="flex-1 text-foreground">{label}</span>
      <ChevronRight className="w-5 h-5 text-muted-foreground" />
    </Link>
  );
}
