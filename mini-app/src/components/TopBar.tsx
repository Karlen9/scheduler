"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface TopBarProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
}

export function TopBar({ title, showBack = false, onBack }: TopBarProps) {
  const router = useRouter();
  const tc = useTranslations("Common");

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <div className="sticky top-0 z-10 flex items-center h-14 px-4 bg-background border-b border-border">
      {showBack && (
        <button
          onClick={handleBack}
          className="flex items-center justify-center w-10 h-10 -ml-2 mr-1"
          aria-label={tc("back")}
        >
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
      )}
      <h1 className="flex-1 text-lg font-medium text-foreground">
        {title}
      </h1>
    </div>
  );
}
