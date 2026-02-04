export function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="bg-[var(--app-surface)] rounded-xl p-4 mb-4">
        <div className="flex gap-4 mb-3">
          <div className="w-20 h-20 rounded-full bg-[var(--app-divider)]" />
          <div className="flex-1">
            <div className="h-5 bg-[var(--app-divider)] rounded w-32 mb-2" />
            <div className="h-4 bg-[var(--app-divider)] rounded w-24 mb-2" />
            <div className="h-4 bg-[var(--app-divider)] rounded w-16" />
          </div>
        </div>
        <div className="h-4 bg-[var(--app-divider)] rounded w-full mb-2" />
        <div className="h-4 bg-[var(--app-divider)] rounded w-3/4" />
      </div>
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="animate-pulse bg-[var(--app-surface)] rounded-xl p-4">
      <div className="h-10 bg-[var(--app-divider)] rounded w-48 mx-auto mb-4" />
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square bg-[var(--app-divider)] rounded-lg"
          />
        ))}
      </div>
    </div>
  );
}

export function BookingCardSkeleton() {
  return (
    <div className="animate-pulse bg-[var(--app-surface)] rounded-xl p-4">
      <div className="flex justify-between mb-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-[var(--app-divider)] rounded w-32" />
          <div className="h-4 bg-[var(--app-divider)] rounded w-24" />
          <div className="h-4 bg-[var(--app-divider)] rounded w-28" />
        </div>
        <div className="h-6 w-24 bg-[var(--app-divider)] rounded-full" />
      </div>
      <div className="pt-3 border-t border-[var(--app-divider)]">
        <div className="h-4 bg-[var(--app-divider)] rounded w-40 mb-3" />
        <div className="flex gap-2">
          <div className="flex-1 h-9 bg-[var(--app-divider)] rounded-lg" />
          <div className="flex-1 h-9 bg-[var(--app-divider)] rounded-lg" />
        </div>
      </div>
    </div>
  );
}
