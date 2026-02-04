"use client";

import { ReactNode } from "react";
import { AdminBottomNav } from "./AdminBottomNav";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div
      className="min-h-screen bg-[var(--app-bg)]"
      style={{ maxWidth: "430px", margin: "0 auto" }}
    >
      <div className="pb-20">{children}</div>
      <AdminBottomNav />
    </div>
  );
}
