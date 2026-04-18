# Clickable Home Modals — Design Spec

## Overview

On the client home page (`mini-app/src/app/(client)/page.tsx`) the specialist profile exposes two bottom-sheet modals: **services** and **schedule**. Items in both are currently read-only. This spec makes them clickable, routing users to the booking page with a preselection applied via URL query params.

- **Services modal** → clicking a service opens `/book?service=<id>` with that service preselected.
- **Schedule modal** → clicking a weekday row opens `/book?date=<YYYY-MM-DD>` with the nearest upcoming occurrence of that weekday preselected. The user then picks a service.

Implementation is URL-driven (Next.js search params) — no cross-page state, shareable links, back button works naturally, and Next.js `<Link>` prefetches on its own.

---

## 1. Schedule modal — one row per weekday

Currently `scheduleGroups` in `page.tsx:200-226` collapses consecutive days that share the same hours ("Mon-Tue-Wed"). Drop the collapse.

- Render **7 rows**, Monday through Sunday (same `scheduleDayOrder` constant).
- Each row stores its single `day: number` (0 = Sun … 6 = Sat) for click-target computation.
- Closed days stay in the list, muted, non-interactive.

New row shape:

```ts
type TScheduleRow = {
  day: number; // 0-6, matches Date.getDay()
  dayLabel: string; // translated short name, e.g. "Пн"
  hoursLabel: string; // "09:00-18:00" or translated "closed"
  isClosed: boolean;
};
```

---

## 2. "Nearest upcoming weekday" logic

For an open weekday row, compute the next occurrence:

```ts
function nextDateForWeekday(targetDay: number, today: Date): Date {
  const delta = (targetDay - today.getDay() + 7) % 7; // 0 if today matches
  const next = new Date(today);
  next.setDate(today.getDate() + delta);
  next.setHours(0, 0, 0, 0);
  return next;
}
```

- Today's weekday → `delta = 0` → opens today. (Confirmed decision: soonest.)
- Future day → 1-6 days out.
- Output is formatted to `YYYY-MM-DD` via the existing `formatDateISO` helper before building the URL.

Helper lives in `mini-app/src/lib/helpers.ts` alongside `formatDateISO`.

---

## 3. `/book` — preselection plumbing

The admin side already reads `?date=` and passes `initialDate` to `BookingForm`. We extend this pattern for the client side and add a second param for services.

### 3a. Lift `parseDateParam`

Currently defined inside `mini-app/src/app/admin/book/page.tsx:14`. Lift to `mini-app/src/lib/helpers.ts` as `parseDateParam(raw: string | null): Date | undefined`. Update the admin import. No behavior change.

### 3b. `ClientBookContent` reads both params

File: `mini-app/src/app/(client)/(activity)/book/page.tsx`

```tsx
const searchParams = useSearchParams();
const initialDate = useMemo(
  () => parseDateParam(searchParams.get("date")),
  [searchParams],
);
const initialServiceId = searchParams.get("service");
const initialService = useMemo(
  () => services.find((s) => s.id === initialServiceId) ?? undefined,
  [services, initialServiceId],
);
```

Both are passed to `<BookingForm initialDate={initialDate} initialService={initialService} ... />`.

Wrap `ClientBookContent` in `<Suspense>` (already done in existing code) so `useSearchParams` doesn't break SSG.

### 3c. Add `initialService` prop to `BookingForm`

File: `mini-app/src/components/BookingForm/index.tsx`

- Add `initialService?: TSessionType` to `TBookingFormProps`.
- Pass through to `OnetimeBookingFlow`, which passes to `useOnetimeBooking`.

### 3d. Extend `useOnetimeBooking` with `initialService` effect

File: `mini-app/src/components/BookingForm/useOnetimeBooking.ts`

Mirror the existing `initialDate` effect (`useOnetimeBooking.ts:197-209`):

```ts
const appliedInitialServiceKeyRef = useRef<string | null>(null);

useEffect(() => {
  if (!initialService) return;
  if (appliedInitialServiceKeyRef.current === initialService.id) return;
  appliedInitialServiceKeyRef.current = initialService.id;
  // Use internal handler so existing reset side-effects fire consistently.
  handleServiceSelect(initialService);
}, [initialService]); // eslint-disable-line react-hooks/exhaustive-deps
```

Why the ref-gate: service selection resets `selectedDate`. Without the gate, running the effect after a user switches service back would clobber in-progress picks. The existing `initialDate` effect uses the same pattern.

Existing auto-select-single-service logic (`useOnetimeBooking.ts:106-110`) stays — but only kicks in when `initialService` is not supplied, because once `initialService` triggers `handleServiceSelect`, `selectedService` is set and the auto-select effect's `!selectedService` guard short-circuits.

### 3e. Interaction with `initialDate`

Both effects can run together: `initialService` sets service → `initialDate` effect sees `selectedService` truthy → applies date. No ordering issue because both are idempotent (ref-gated).

---

## 4. Click handlers on modal items

File: `mini-app/src/app/(client)/page.tsx`

Both modals' items become `<Link>`s:

```tsx
// Services modal
<Link
  key={service.id}
  href={resolveTestAwareHref(pathname, `/book?service=${service.id}`)}
  onClick={() => setActiveModal(null)}
  className="bg-background flex items-center gap-3 rounded-lg p-3 active:opacity-80"
>
  {/* same content as current <div> */}
</Link>
```

```tsx
// Schedule modal — open rows only
<Link
  key={row.day}
  href={resolveTestAwareHref(
    pathname,
    `/book?date=${formatDateISO(nextDateForWeekday(row.day, new Date()))}`,
  )}
  onClick={() => setActiveModal(null)}
  className="bg-background flex items-center justify-between gap-4 rounded-lg p-3 active:opacity-80"
>
  {/* row content */}
</Link>
```

Closed rows stay as `<div>` — unchanged from today visually, just no collapse.

### Optimization notes

- `<Link>` prefetches `/book` on hover / viewport intersection — the route is lightweight so this is safe.
- `router.prefetch(bookHref)` is already called in a `useEffect` on mount (`page.tsx:161-163`). That stays and covers the case where users tap without hovering (mobile).
- No extra state, no effects, no memoization beyond what React already gives `<Link>`.
- The "next weekday" date is computed inline at click-time via `href={...}`. It's cheap (modulo arithmetic) and re-runs each render, guaranteeing the date stays fresh even if the modal is left open past midnight.

---

## 5. File-level change summary

| File                                                         | Change                                                                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `mini-app/src/lib/helpers.ts`                                | Add `parseDateParam`, `nextDateForWeekday` helpers                                                                 |
| `mini-app/src/app/admin/book/page.tsx`                       | Import `parseDateParam` from helpers (remove local copy)                                                           |
| `mini-app/src/app/(client)/(activity)/book/page.tsx`         | Read `?date=` and `?service=`, pass `initialDate`/`initialService`                                                 |
| `mini-app/src/components/BookingForm/index.tsx`              | Add `initialService` prop, pass through                                                                            |
| `mini-app/src/components/BookingForm/OnetimeBookingFlow.tsx` | Pass `initialService` to hook                                                                                      |
| `mini-app/src/components/BookingForm/useOnetimeBooking.ts`   | Accept `initialService`, add ref-gated effect                                                                      |
| `mini-app/src/lib/types.ts`                                  | Add `initialService?: TSessionType` to `TBookingFormProps`, `TOnetimeBookingFlowProps`, `TUseOnetimeBookingParams` |
| `mini-app/src/app/(client)/page.tsx`                         | Drop day-collapse logic; convert modal items to `<Link>`                                                           |

---

## 6. Testing

- Unit test `nextDateForWeekday`: for each combination of `today.getDay()` ∈ 0..6 and `targetDay` ∈ 0..6, assert the result's `getDay()` equals `targetDay` and delta is in `[0, 6]`.
- Unit test `parseDateParam`: valid, invalid format, overflow normalization (`2026-02-31`), null.
- Component test (vitest + RTL) for `useOnetimeBooking`: passing `initialService` sets `selectedService`; passing both `initialService` and `initialDate` ends with both applied; changing service via `handleEditService` then passing a new `initialService` re-applies.
- Manual check: open services modal → tap service → land on `/book?service=<id>` with service preselected and calendar visible. Open schedule modal → tap Monday → land on `/book?date=<YYYY-MM-DD>` with services list; after service pick, that date is already selected and time slots load.

---

## 7. Non-goals

- No recurring flow preselection — that flow is hidden on the client book page (`showRecurring={false}`).
- No back-navigation memory (user lands on `/book`, navigating back returns to home as today).
- No multi-param combination (e.g. `?service=X&date=Y`) exposed in UI, but the plumbing supports it for free if ever needed.
