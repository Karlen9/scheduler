"use client";

import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = "", onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] ${onClick ? "cursor-pointer active:scale-[0.99] transition-transform" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
