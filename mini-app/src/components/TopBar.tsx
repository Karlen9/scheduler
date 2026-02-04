"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface TopBarProps {
  title: string;
  showBack?: boolean;
}

export function TopBar({ title, showBack = false }: TopBarProps) {
  const router = useRouter();

  return (
    <div className="sticky top-0 z-10 flex items-center h-14 px-4 bg-[var(--app-bg)] border-b border-[var(--app-divider)]">
      {showBack && (
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center w-10 h-10 -ml-2 mr-1"
          aria-label="Назад"
        >
          <ArrowLeft className="w-6 h-6 text-[var(--app-text)]" />
        </button>
      )}
      <h1 className="flex-1 text-lg font-medium text-[var(--app-text)]">
        {title}
      </h1>
    </div>
  );
}
