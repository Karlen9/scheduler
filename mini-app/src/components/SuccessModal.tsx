"use client";

import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { PrimaryButton } from "@/components/PrimaryButton";

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
}

export function SuccessModal({
  isOpen,
  onClose,
  title,
  description,
}: SuccessModalProps) {
  const tc = useTranslations("Common");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-background rounded-2xl p-6 w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-16 h-16 text-success" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <PrimaryButton onClick={onClose}>{tc("great")}</PrimaryButton>
      </div>
    </div>
  );
}
