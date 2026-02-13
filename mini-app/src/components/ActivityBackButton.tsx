"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface ActivityBackButtonProps {
  href: string;
}

export function ActivityBackButton({ href }: ActivityBackButtonProps) {
  return (
    <div className="px-3 pt-3">
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-base text-muted-foreground py-2 px-2 -ml-2 rounded-xl active:bg-card transition-colors"
      >
        <ChevronLeft className="w-6 h-6" />
        <span>Назад</span>
      </Link>
    </div>
  );
}
