"use client";

import { X } from "lucide-react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  /** Show close X button (top-right). Default: true */
  showClose?: boolean;
  /** Extra classes on the content container */
  className?: string;
}

export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  showClose = true,
  className = "",
}: BottomSheetProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={`relative w-full bg-background rounded-t-2xl p-4 animate-slide-up ${className}`}
        style={{ maxWidth: "430px" }}
      >
        {(title || showClose) && (
          <div className="flex items-center justify-between mb-4">
            {title ? (
              <h3 className="text-lg font-medium text-foreground">{title}</h3>
            ) : (
              <div />
            )}
            {showClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-card"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
          </div>
        )}
        {children}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}
