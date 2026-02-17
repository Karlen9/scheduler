const statusStyles: Record<string, { label: string; color: string }> = {
  // Booking statuses
  pending: { label: "Ожидает", color: "bg-status-pending-bg text-status-pending-text" },
  confirmed: { label: "Подтверждено", color: "bg-status-confirmed-bg text-status-confirmed-text" },
  rejected: { label: "Отклонено", color: "bg-status-rejected-bg text-status-rejected-text" },
  cancelled: { label: "Отменено", color: "bg-status-cancelled-bg text-status-cancelled-text" },
  completed: { label: "Завершено", color: "bg-status-completed-bg text-status-completed-text" },
  cancel_requested: { label: "Отмена запрошена", color: "bg-status-warning-bg text-status-warning-text" },
  reschedule_pending: { label: "Перенос", color: "bg-status-purple-bg text-status-purple-text" },
  // Recurring schedule statuses
  active: { label: "Активно", color: "bg-status-confirmed-bg text-status-confirmed-text" },
  declined: { label: "Отклонено", color: "bg-status-rejected-bg text-status-rejected-text" },
};

export const statusBorders: Record<string, string> = {
  pending: "border-status-pending-border",
  active: "border-status-confirmed-border",
  declined: "border-status-rejected-border",
  cancelled: "border-status-cancelled-border",
};

export function getStatusStyle(status: string) {
  return statusStyles[status] || statusStyles.pending;
}

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const style = getStatusStyle(status);
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${style.color} ${className}`}>
      {style.label}
    </span>
  );
}
