export function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="bg-card mb-4 rounded-xl p-4">
        <div className="mb-3 flex gap-4">
          <div className="bg-border h-20 w-20 rounded-full" />
          <div className="flex-1">
            <div className="bg-border mb-2 h-5 w-32 rounded" />
            <div className="bg-border mb-2 h-4 w-24 rounded" />
            <div className="bg-border h-4 w-16 rounded" />
          </div>
        </div>
        <div className="bg-border mb-2 h-4 w-full rounded" />
        <div className="bg-border h-4 w-3/4 rounded" />
      </div>
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="bg-card animate-pulse rounded-xl p-4">
      <div className="bg-border mx-auto mb-4 h-8 w-40 rounded" />
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="bg-border aspect-square rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/** Client BookingCard skeleton — matches BookingCard.tsx layout */
export function BookingCardSkeleton() {
  return (
    <div className="bg-card animate-pulse rounded-xl p-4">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="bg-border h-4 w-4 rounded" />
            <div className="bg-border h-4 w-36 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-border h-4 w-4 rounded" />
            <div className="bg-border h-4 w-28 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-border h-4 w-4 rounded" />
            <div className="bg-border h-4 w-32 rounded" />
          </div>
        </div>
        <div className="bg-border h-6 w-20 shrink-0 rounded-full" />
      </div>
      <div className="border-border border-t pt-3">
        <div className="bg-border h-9 w-full rounded-lg" />
      </div>
    </div>
  );
}

/** Admin PendingBookingCard skeleton — avatar + name + info + accept/reject buttons */
export function PendingBookingCardSkeleton() {
  return (
    <div className="bg-card border-l-border animate-pulse rounded-xl border-l-4 p-4">
      <div className="flex items-start gap-3">
        <div className="bg-border h-10 w-10 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="bg-border h-4 w-28 rounded" />
          <div className="bg-border h-3.5 w-32 rounded" />
          <div className="bg-border h-3.5 w-40 rounded" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <div className="bg-border h-9 flex-1 rounded-lg" />
        <div className="bg-border h-9 flex-1 rounded-lg" />
      </div>
    </div>
  );
}

/** Admin UpcomingBookingCard skeleton — avatar + name + time on right */
export function UpcomingBookingCardSkeleton() {
  return (
    <div className="bg-card border-l-border animate-pulse rounded-xl border-l-4 p-4">
      <div className="flex items-center gap-3">
        <div className="bg-border h-10 w-10 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="bg-border h-4 w-28 rounded" />
          <div className="bg-border h-3.5 w-32 rounded" />
        </div>
        <div className="shrink-0 space-y-1.5">
          <div className="bg-border h-4 w-24 rounded" />
          <div className="bg-border ml-auto h-3 w-16 rounded" />
        </div>
      </div>
    </div>
  );
}

/** RecurringScheduleCard skeleton — icon rows + status badge + action buttons */
export function RecurringScheduleCardSkeleton() {
  return (
    <div className="bg-card border-l-border animate-pulse rounded-xl border-l-4 p-4">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="bg-border h-4 w-4 rounded" />
            <div className="bg-border h-4 w-24 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-border h-4 w-4 rounded" />
            <div className="bg-border h-4 w-20 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-border h-4 w-4 rounded" />
            <div className="bg-border h-4 w-32 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-border h-4 w-4 rounded" />
            <div className="bg-border h-4 w-28 rounded" />
          </div>
        </div>
        <div className="bg-border h-6 w-20 shrink-0 rounded-full" />
      </div>
      <div className="border-border border-t pt-3">
        <div className="flex gap-2">
          <div className="bg-border h-9 flex-1 rounded-lg" />
          <div className="bg-border h-9 flex-1 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** Admin book page skeleton — search input + client list */
export function ClientListSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="bg-card h-4 w-36 rounded" />
      <div className="bg-card h-12 rounded-lg" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-card flex items-center gap-3 rounded-xl p-4">
            <div className="bg-border h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="bg-border h-4 w-1/2 rounded" />
              <div className="bg-border h-3.5 w-1/3 rounded" />
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
    <div className="animate-pulse space-y-6 p-4">
      {/* Form card */}
      <div className="bg-card space-y-4 rounded-xl p-4">
        <div className="bg-border h-4 w-40 rounded" />
        {/* Client select */}
        <div className="space-y-2">
          <div className="bg-border h-3.5 w-16 rounded" />
          <div className="bg-border h-12 rounded-lg" />
        </div>
        {/* Service select */}
        <div className="space-y-2">
          <div className="bg-border h-3.5 w-16 rounded" />
          <div className="bg-border h-10 rounded-lg" />
        </div>
        {/* Day circles */}
        <div className="space-y-2">
          <div className="bg-border h-3.5 w-24 rounded" />
          <div className="flex gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="bg-border h-10 w-10 rounded-full" />
            ))}
          </div>
        </div>
        {/* Submit button */}
        <div className="bg-border h-11 rounded-xl" />
      </div>
      {/* Schedule cards */}
      <div className="space-y-3">
        <div className="bg-card h-4 w-36 rounded" />
        {Array.from({ length: 2 }).map((_, i) => (
          <RecurringScheduleCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
