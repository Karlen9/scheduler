"use client";

import { useTranslations } from "next-intl";

const statusColors: Record<string, string> = {
  pending: "bg-status-pending-bg text-status-pending-text",
  confirmed: "bg-status-confirmed-bg text-status-confirmed-text",
  rejected: "bg-status-rejected-bg text-status-rejected-text",
  cancelled: "bg-status-cancelled-bg text-status-cancelled-text",
  completed: "bg-status-completed-bg text-status-completed-text",
  cancel_requested: "bg-status-warning-bg text-status-warning-text",
  reschedule_pending: "bg-status-purple-bg text-status-purple-text",
  active: "bg-status-confirmed-bg text-status-confirmed-text",
  declined: "bg-status-rejected-bg text-status-rejected-text",
};

const statusKeyMap: Record<string, string> = {
  pending: "pending",
  confirmed: "confirmed",
  rejected: "rejected",
  cancelled: "cancelled",
  completed: "completed",
  cancel_requested: "cancelRequested",
  reschedule_pending: "reschedulePending",
  active: "active",
  declined: "declined",
};

export const statusBorders: Record<string, string> = {
  pending: "border-status-pending-border",
  active: "border-status-confirmed-border",
  declined: "border-status-rejected-border",
  cancelled: "border-status-cancelled-border",
};

export function getStatusColor(status: string) {
  return statusColors[status] || statusColors.pending;
}

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const ts = useTranslations("Status");
  const color = statusColors[status] || statusColors.pending;
  const key = statusKeyMap[status] || "pending";
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${color} ${className}`}>
      {ts(key)}
    </span>
  );
}
