const statusStyles: Record<string, { label: string; color: string }> = {
  // Booking statuses
  pending: { label: "Ожидает", color: "bg-yellow-900/30 text-yellow-400" },
  confirmed: { label: "Подтверждено", color: "bg-green-900/30 text-green-400" },
  rejected: { label: "Отклонено", color: "bg-red-900/30 text-red-400" },
  cancelled: { label: "Отменено", color: "bg-gray-700/30 text-gray-400" },
  completed: { label: "Завершено", color: "bg-blue-900/30 text-blue-400" },
  cancel_requested: { label: "Отмена запрошена", color: "bg-orange-900/30 text-orange-400" },
  reschedule_pending: { label: "Перенос", color: "bg-purple-900/30 text-purple-400" },
  // Recurring schedule statuses
  active: { label: "Активно", color: "bg-green-900/30 text-green-400" },
  declined: { label: "Отклонено", color: "bg-red-900/30 text-red-400" },
};

export const statusBorders: Record<string, string> = {
  pending: "border-yellow-500",
  active: "border-green-500",
  declined: "border-red-500",
  cancelled: "border-gray-500",
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
