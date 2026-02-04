"use client";

import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        style: {
          background: "var(--app-surface)",
          color: "var(--app-text)",
          border: "1px solid var(--app-divider)",
        },
      }}
    />
  );
}
