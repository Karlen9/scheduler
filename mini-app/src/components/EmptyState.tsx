interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-16 h-16 flex items-center justify-center mb-4 text-[var(--app-subtext)]">
        {icon}
      </div>
      <h3 className="text-lg font-medium text-[var(--app-text)] mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--app-subtext)] mb-6 max-w-xs">
          {description}
        </p>
      )}
      {action && <div className="w-full max-w-xs">{action}</div>}
    </div>
  );
}
