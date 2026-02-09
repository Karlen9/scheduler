"use client";

import { PrimaryButton } from "@/components/PrimaryButton";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  showInput?: boolean;
  inputPlaceholder?: string;
  inputValue?: string;
  onInputChange?: (value: string) => void;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Подтвердить",
  cancelText = "Отмена",
  destructive = false,
  showInput = false,
  inputPlaceholder,
  inputValue,
  onInputChange,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-background rounded-2xl p-6 w-full max-w-sm">
        <h3 className="text-lg font-medium text-foreground mb-2">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-muted-foreground mb-4">
            {description}
          </p>
        )}
        {showInput && (
          <input
            type="text"
            value={inputValue || ""}
            onChange={(e) => onInputChange?.(e.target.value)}
            placeholder={inputPlaceholder}
            className="w-full px-4 py-3 rounded-lg bg-card text-foreground outline-none focus:ring-2 focus:ring-brand mb-4 text-sm"
          />
        )}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-card text-foreground font-medium text-base transition-opacity active:opacity-70"
          >
            {cancelText}
          </button>
          {destructive ? (
            <button
              onClick={handleConfirm}
              className="flex-1 py-3 px-4 rounded-xl bg-destructive text-white font-medium text-base transition-opacity active:opacity-70"
            >
              {confirmText}
            </button>
          ) : (
            <div className="flex-1">
              <PrimaryButton onClick={handleConfirm}>
                {confirmText}
              </PrimaryButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
