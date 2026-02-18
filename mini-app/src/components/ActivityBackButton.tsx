"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";

interface ActivityBackButtonProps {
  href: string;
}

export function ActivityBackButton({ href }: ActivityBackButtonProps) {
  const tc = useTranslations("Common");

  return (
    <div className="px-4 pt-4">
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground py-2.5 px-3.5 rounded-full bg-tab-bar border border-tab-bar-border active:scale-95 transition-transform"
      >
        <ChevronLeft className="w-5 h-5" />
        <span>{tc("back")}</span>
      </Link>
    </div>
  );
}
