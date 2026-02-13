export function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="bg-card rounded-xl p-4 mb-4">
        <div className="flex gap-4 mb-3">
          <div className="w-20 h-20 rounded-full bg-border" />
          <div className="flex-1">
            <div className="h-5 bg-border rounded w-32 mb-2" />
            <div className="h-4 bg-border rounded w-24 mb-2" />
            <div className="h-4 bg-border rounded w-16" />
          </div>
        </div>
        <div className="h-4 bg-border rounded w-full mb-2" />
        <div className="h-4 bg-border rounded w-3/4" />
      </div>
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="animate-pulse bg-card rounded-xl p-4">
      <div className="h-8 bg-border rounded w-40 mx-auto mb-4" />
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square bg-border rounded-lg"
          />
        ))}
      </div>
    </div>
  );
}

/** Client BookingCard skeleton — matches BookingCard.tsx layout */
export function BookingCardSkeleton() {
  return (
    <div className="animate-pulse bg-card rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-border rounded" />
            <div className="h-4 bg-border rounded w-36" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-border rounded" />
            <div className="h-4 bg-border rounded w-28" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-border rounded" />
            <div className="h-4 bg-border rounded w-32" />
          </div>
        </div>
        <div className="h-6 w-20 bg-border rounded-full shrink-0" />
      </div>
      <div className="pt-3 border-t border-border">
        <div className="h-9 bg-border rounded-lg w-full" />
      </div>
    </div>
  );
}

/** Admin PendingBookingCard skeleton — avatar + name + info + accept/reject buttons */
export function PendingBookingCardSkeleton() {
  return (
    <div className="animate-pulse bg-card rounded-xl p-4 border-l-4 border-l-border">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-border shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-border rounded w-28" />
          <div className="h-3.5 bg-border rounded w-32" />
          <div className="h-3.5 bg-border rounded w-40" />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <div className="flex-1 h-9 bg-border rounded-lg" />
        <div className="flex-1 h-9 bg-border rounded-lg" />
      </div>
    </div>
  );
}

/** Admin UpcomingBookingCard skeleton — avatar + name + time on right */
export function UpcomingBookingCardSkeleton() {
  return (
    <div className="animate-pulse bg-card rounded-xl p-4 border-l-4 border-l-border">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-border shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-border rounded w-28" />
          <div className="h-3.5 bg-border rounded w-32" />
        </div>
        <div className="space-y-1.5 shrink-0">
          <div className="h-4 bg-border rounded w-24" />
          <div className="h-3 bg-border rounded w-16 ml-auto" />
        </div>
      </div>
    </div>
  );
}

/** RecurringScheduleCard skeleton — icon rows + status badge + action buttons */
export function RecurringScheduleCardSkeleton() {
  return (
    <div className="animate-pulse bg-card rounded-xl p-4 border-l-4 border-l-border">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-border rounded" />
            <div className="h-4 bg-border rounded w-24" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-border rounded" />
            <div className="h-4 bg-border rounded w-20" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-border rounded" />
            <div className="h-4 bg-border rounded w-32" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-border rounded" />
            <div className="h-4 bg-border rounded w-28" />
          </div>
        </div>
        <div className="h-6 w-20 bg-border rounded-full shrink-0" />
      </div>
      <div className="pt-3 border-t border-border">
        <div className="flex gap-2">
          <div className="flex-1 h-9 bg-border rounded-lg" />
          <div className="flex-1 h-9 bg-border rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** Admin book page skeleton — search input + client list */
export function ClientListSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-4 bg-card rounded w-36" />
      <div className="h-12 bg-card rounded-lg" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-border shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-border rounded w-1/2" />
              <div className="h-3.5 bg-border rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Recurring page skeleton — form card + schedule cards */
export function RecurringPageSkeleton() {
  return (
    <div className="animate-pulse p-4 space-y-6">
      {/* Form card */}
      <div className="bg-card rounded-xl p-4 space-y-4">
        <div className="h-4 bg-border rounded w-40" />
        {/* Client select */}
        <div className="space-y-2">
          <div className="h-3.5 bg-border rounded w-16" />
          <div className="h-12 bg-border rounded-lg" />
        </div>
        {/* Service select */}
        <div className="space-y-2">
          <div className="h-3.5 bg-border rounded w-16" />
          <div className="h-10 bg-border rounded-lg" />
        </div>
        {/* Day circles */}
        <div className="space-y-2">
          <div className="h-3.5 bg-border rounded w-24" />
          <div className="flex gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="w-10 h-10 rounded-full bg-border" />
            ))}
          </div>
        </div>
        {/* Submit button */}
        <div className="h-11 bg-border rounded-xl" />
      </div>
      {/* Schedule cards */}
      <div className="space-y-3">
        <div className="h-4 bg-card rounded w-36" />
        {Array.from({ length: 2 }).map((_, i) => (
          <RecurringScheduleCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
