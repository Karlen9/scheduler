# Clickable Home Modals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make services and schedule modal items on the client home page clickable, routing to `/book` with the tapped service or nearest-upcoming weekday preselected via URL query params.

**Architecture:** URL-driven preselection. Services modal items link to `/book?service=<id>`; schedule modal rows link to `/book?date=<YYYY-MM-DD>`. The existing `initialDate` plumbing (admin side) is reused, extended with a parallel `initialService` prop that flows `page → BookingForm → OnetimeBookingFlow → useOnetimeBooking`. Schedule rows no longer collapse consecutive days with identical hours, so each weekday is independently clickable.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, vitest, next-intl, Tailwind.

**Spec:** `docs/superpowers/specs/2026-04-18-clickable-home-modals-design.md`

---

## File Structure

- `mini-app/src/lib/helpers.ts` — add `parseDateParam` (lifted from admin page) and `nextDateForWeekday`.
- `mini-app/src/lib/__tests__/helpers.test.ts` — add tests for both new helpers.
- `mini-app/src/lib/types.ts` — add `initialService?: TSessionType` to three prop types.
- `mini-app/src/app/admin/book/page.tsx` — remove local `parseDateParam`, import from helpers.
- `mini-app/src/app/(client)/(activity)/book/page.tsx` — read `?date=` and `?service=`, pass props to `BookingForm`.
- `mini-app/src/components/BookingForm/index.tsx` — accept `initialService`, forward to `OnetimeBookingFlow`.
- `mini-app/src/components/BookingForm/OnetimeBookingFlow.tsx` — forward `initialService` to hook.
- `mini-app/src/components/BookingForm/useOnetimeBooking.ts` — accept `initialService`, add ref-gated effect that applies it.
- `mini-app/src/app/(client)/page.tsx` — drop day-collapsing in `scheduleGroups`, render 7 rows, convert modal items to `<Link>`.

---

## Task 1: Add `parseDateParam` and `nextDateForWeekday` helpers (tests first)

**Files:**

- Modify: `mini-app/src/lib/helpers.ts`
- Test: `mini-app/src/lib/__tests__/helpers.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `mini-app/src/lib/__tests__/helpers.test.ts`:

```ts
import { nextDateForWeekday, parseDateParam } from "../helpers";

describe("parseDateParam", () => {
  it("returns undefined for null", () => {
    expect(parseDateParam(null)).toBeUndefined();
  });

  it("returns undefined for malformed input", () => {
    expect(parseDateParam("2026-4-1")).toBeUndefined();
    expect(parseDateParam("not-a-date")).toBeUndefined();
    expect(parseDateParam("")).toBeUndefined();
  });

  it("returns undefined when the date overflows (e.g. Feb 31)", () => {
    expect(parseDateParam("2026-02-31")).toBeUndefined();
  });

  it("parses a valid YYYY-MM-DD into a local Date", () => {
    const d = parseDateParam("2026-04-18");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(3);
    expect(d!.getDate()).toBe(18);
  });
});

describe("nextDateForWeekday", () => {
  it("returns today when targetDay equals today.getDay()", () => {
    const today = new Date(2026, 3, 18); // Saturday
    const result = nextDateForWeekday(today.getDay(), today);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(3);
    expect(result.getDate()).toBe(18);
  });

  it("returns the next occurrence within 1-6 days for a future weekday", () => {
    const today = new Date(2026, 3, 18); // Saturday, getDay() = 6
    const result = nextDateForWeekday(1, today); // Monday
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(20);
  });

  it("handles wrap-around across month boundaries", () => {
    const today = new Date(2026, 3, 30); // Thursday Apr 30, getDay() = 4
    const result = nextDateForWeekday(1, today); // Monday
    expect(result.getDay()).toBe(1);
    expect(result.getMonth()).toBe(4); // May
    expect(result.getDate()).toBe(4);
  });

  it("normalizes the returned time to midnight", () => {
    const today = new Date(2026, 3, 18, 15, 30, 45);
    const result = nextDateForWeekday(2, today);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `cd mini-app && bunx vitest run src/lib/__tests__/helpers.test.ts`

Expected: failure with "parseDateParam is not a function" and "nextDateForWeekday is not a function".

- [ ] **Step 3: Implement both helpers**

Append to `mini-app/src/lib/helpers.ts`:

```ts
export function parseDateParam(raw: string | null): Date | undefined {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return undefined;
  }
  const [y, m, d] = raw.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return undefined;
  }
  return date;
}

export function nextDateForWeekday(targetDay: number, today: Date): Date {
  const delta = (targetDay - today.getDay() + 7) % 7;
  const next = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + delta,
  );
  return next;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mini-app && bunx vitest run src/lib/__tests__/helpers.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add mini-app/src/lib/helpers.ts mini-app/src/lib/__tests__/helpers.test.ts
git commit -m "feat(helpers): add parseDateParam and nextDateForWeekday"
```

---

## Task 2: Consolidate admin `parseDateParam` to shared helper

**Files:**

- Modify: `mini-app/src/app/admin/book/page.tsx`

- [ ] **Step 1: Update the import and remove the local copy**

In `mini-app/src/app/admin/book/page.tsx`, replace the top-of-file local definition with an import. The current structure is:

```tsx
// line 1-3 imports (unchanged)
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { BookingForm } from "@/components/BookingForm";
import { invalidateClients } from "@/hooks/mutations";
import {
  useAdminScheduleContext,
  useAdminServices,
  useClients,
} from "@/hooks/queries";
import { api } from "@/lib/api";

import type { ReactNode } from "react";

function parseDateParam(raw: string | null): Date | undefined {
  // ... 20-line implementation (lines 14-32)
}
```

Change to:

```tsx
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { BookingForm } from "@/components/BookingForm";
import { invalidateClients } from "@/hooks/mutations";
import {
  useAdminScheduleContext,
  useAdminServices,
  useClients,
} from "@/hooks/queries";
import { api } from "@/lib/api";
import { parseDateParam } from "@/lib/helpers";

import type { ReactNode } from "react";
```

Delete the local `function parseDateParam` (formerly at lines 14-32). The rest of the file (the `AdminBookPage` component) is unchanged.

- [ ] **Step 2: Verify compilation and lint**

Run:

```bash
cd mini-app && bun run lint
```

Expected: no errors.

- [ ] **Step 3: Run tests to verify nothing regressed**

Run: `cd mini-app && bunx vitest run`

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add mini-app/src/app/admin/book/page.tsx
git commit -m "refactor(admin): import parseDateParam from lib/helpers"
```

---

## Task 3: Add `initialService` prop to shared types

**Files:**

- Modify: `mini-app/src/lib/types.ts`

- [ ] **Step 1: Add the prop to `TBookingFormProps`**

In `mini-app/src/lib/types.ts`, locate `TBookingFormProps` (around line 550). The current last fields are:

```ts
  successRedirect: string;
  title?: string;
  initialDate?: Date;
};
```

Change to:

```ts
  successRedirect: string;
  title?: string;
  initialDate?: Date;
  initialService?: TSessionType;
};
```

- [ ] **Step 2: Add the prop to `TOnetimeBookingFlowProps`**

Locate `TOnetimeBookingFlowProps` (around line 771). The last field is:

```ts
  initialDate?: Date;
};
```

Change to:

```ts
  initialDate?: Date;
  initialService?: TSessionType;
};
```

- [ ] **Step 3: Add the prop to `TUseOnetimeBookingParams`**

Locate `TUseOnetimeBookingParams` (around line 1067). The last field is:

```ts
  initialDate?: Date;
};
```

Change to:

```ts
  initialDate?: Date;
  initialService?: TSessionType;
};
```

- [ ] **Step 4: Verify compilation**

Run: `cd mini-app && bun run lint`

Expected: no new errors. (`TSessionType` is already imported/used in this file.)

- [ ] **Step 5: Commit**

```bash
git add mini-app/src/lib/types.ts
git commit -m "feat(types): add initialService prop to booking form types"
```

---

## Task 4: Plumb `initialService` through `BookingForm` and `OnetimeBookingFlow`

**Files:**

- Modify: `mini-app/src/components/BookingForm/index.tsx`
- Modify: `mini-app/src/components/BookingForm/OnetimeBookingFlow.tsx`

- [ ] **Step 1: Accept and forward `initialService` in `BookingForm`**

In `mini-app/src/components/BookingForm/index.tsx`, the destructure currently reads (around line 29-44):

```tsx
export function BookingForm({
  services,
  workingHours: workingHoursData,
  daysOff,
  isLoading: isInitialLoading,
  clients,
  showRecurring = true,
  bookedDates,
  onCreateBooking,
  onCreateRecurring,
  onPreviewRecurring,
  onCreateGhostClient,
  successRedirect,
  title,
  initialDate,
}: TBookingFormProps): ReactNode {
```

Add `initialService`:

```tsx
export function BookingForm({
  services,
  workingHours: workingHoursData,
  daysOff,
  isLoading: isInitialLoading,
  clients,
  showRecurring = true,
  bookedDates,
  onCreateBooking,
  onCreateRecurring,
  onPreviewRecurring,
  onCreateGhostClient,
  successRedirect,
  title,
  initialDate,
  initialService,
}: TBookingFormProps): ReactNode {
```

Then locate the `<OnetimeBookingFlow ... />` JSX (around line 191). The current props are:

```tsx
<OnetimeBookingFlow
  services={services}
  daysOff={daysOff}
  bookedDates={bookedDates}
  showRecurring={showRecurring}
  selectedClient={selectedClient}
  hasClientSelector={hasClientSelector}
  nonWorkingDays={nonWorkingDays}
  onCreateBooking={onCreateBooking}
  successRedirect={successRedirect}
  initialDate={initialDate}
/>
```

Add `initialService={initialService}`:

```tsx
<OnetimeBookingFlow
  services={services}
  daysOff={daysOff}
  bookedDates={bookedDates}
  showRecurring={showRecurring}
  selectedClient={selectedClient}
  hasClientSelector={hasClientSelector}
  nonWorkingDays={nonWorkingDays}
  onCreateBooking={onCreateBooking}
  successRedirect={successRedirect}
  initialDate={initialDate}
  initialService={initialService}
/>
```

- [ ] **Step 2: Accept and forward `initialService` in `OnetimeBookingFlow`**

In `mini-app/src/components/BookingForm/OnetimeBookingFlow.tsx`, the destructure (around line 31-42) is:

```tsx
export function OnetimeBookingFlow({
  services,
  daysOff,
  bookedDates,
  showRecurring,
  selectedClient,
  hasClientSelector,
  nonWorkingDays,
  onCreateBooking,
  successRedirect,
  initialDate,
}: TOnetimeBookingFlowProps): ReactNode {
```

Add `initialService`:

```tsx
export function OnetimeBookingFlow({
  services,
  daysOff,
  bookedDates,
  showRecurring,
  selectedClient,
  hasClientSelector,
  nonWorkingDays,
  onCreateBooking,
  successRedirect,
  initialDate,
  initialService,
}: TOnetimeBookingFlowProps): ReactNode {
```

Locate the `useOnetimeBooking` call (around line 97-105). Current:

```tsx
} = useOnetimeBooking({
  services,
  bookedDates,
  selectedClient,
  hasClientSelector,
  onCreateBooking,
  successRedirect,
  initialDate,
});
```

Add `initialService`:

```tsx
} = useOnetimeBooking({
  services,
  bookedDates,
  selectedClient,
  hasClientSelector,
  onCreateBooking,
  successRedirect,
  initialDate,
  initialService,
});
```

- [ ] **Step 3: Verify compilation**

Run: `cd mini-app && bun run lint`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mini-app/src/components/BookingForm/index.tsx mini-app/src/components/BookingForm/OnetimeBookingFlow.tsx
git commit -m "feat(booking-form): forward initialService prop to onetime flow"
```

---

## Task 5: Apply `initialService` in `useOnetimeBooking`

**Files:**

- Modify: `mini-app/src/components/BookingForm/useOnetimeBooking.ts`

- [ ] **Step 1: Accept the new param**

In `useOnetimeBooking.ts`, the destructure (around line 33-41) is:

```ts
export function useOnetimeBooking({
  services,
  bookedDates,
  selectedClient,
  hasClientSelector,
  onCreateBooking,
  successRedirect,
  initialDate,
}: TUseOnetimeBookingParams): TUseOnetimeBookingReturn {
```

Add `initialService`:

```ts
export function useOnetimeBooking({
  services,
  bookedDates,
  selectedClient,
  hasClientSelector,
  onCreateBooking,
  successRedirect,
  initialDate,
  initialService,
}: TUseOnetimeBookingParams): TUseOnetimeBookingReturn {
```

- [ ] **Step 2: Add a ref and effect that applies `initialService`**

Locate the `appliedInitialDateKeyRef` declaration (around line 127):

```ts
const appliedInitialDateKeyRef = useRef<string | null>(null);
```

Immediately above it, add:

```ts
const appliedInitialServiceKeyRef = useRef<string | null>(null);
```

Then, locate the "Apply initialDate after a service has been chosen" effect (around line 197-209):

```ts
useEffect(() => {
  if (!initialDate || !selectedService) {
    return;
  }
  const key = formatDateISO(initialDate);
  if (appliedInitialDateKeyRef.current === key) {
    return;
  }
  appliedInitialDateKeyRef.current = key;
  setMode("single");
  setSelectedDate(initialDate);
  fetchSlots(initialDate, selectedService.durationMinutes);
}, [initialDate, selectedService, fetchSlots]);
```

Immediately **before** this effect, insert the new `initialService` effect:

```ts
/***************************************************************************************************
 * Apply initialService on mount (or when it changes). Ref-gated by service id so that if the
 * user subsequently edits the service the effect does not clobber their manual choice.
 ***************************************************************************************************/
useEffect(() => {
  if (!initialService) {
    return;
  }
  if (appliedInitialServiceKeyRef.current === initialService.id) {
    return;
  }
  appliedInitialServiceKeyRef.current = initialService.id;
  handleServiceSelect(initialService);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [initialService]);
```

Why `handleServiceSelect` is called directly: it encapsulates the reset of date/time/multi state that should accompany any service change. The `eslint-disable` is safe because `handleServiceSelect` is stable within this hook (not wrapped in useCallback, but defined once per render and only reads state via the most recent closure — re-running on its identity change isn't required).

- [ ] **Step 3: Verify lint**

Run: `cd mini-app && bun run lint`

Expected: no errors beyond any pre-existing ones.

- [ ] **Step 4: Write a unit test for the new effect**

Create `mini-app/src/components/BookingForm/__tests__/useOnetimeBooking.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useOnetimeBooking } from "../useOnetimeBooking";

import type { TSessionType } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/book",
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/mutations", () => ({
  invalidateBookings: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: { getAvailableSlots: vi.fn().mockResolvedValue([]) },
}));

const makeService = (id: string, minutes = 60): TSessionType =>
  ({
    id,
    name: `Service ${id}`,
    durationMinutes: minutes,
    price: 0,
    currency: "RUB",
    imageUrl: null,
  }) as TSessionType;

describe("useOnetimeBooking initialService", () => {
  it("preselects a service when initialService is provided", () => {
    const services = [makeService("a"), makeService("b")];
    const { result } = renderHook(() =>
      useOnetimeBooking({
        services,
        bookedDates: [],
        selectedClient: null,
        hasClientSelector: false,
        onCreateBooking: vi.fn(),
        successRedirect: "/bookings",
        initialService: services[1],
      }),
    );

    expect(result.current.selectedService?.id).toBe("b");
  });

  it("does not re-apply initialService after the user edits the service", () => {
    const services = [makeService("a"), makeService("b")];
    const { result, rerender } = renderHook(
      (props: { initialService?: TSessionType }) =>
        useOnetimeBooking({
          services,
          bookedDates: [],
          selectedClient: null,
          hasClientSelector: false,
          onCreateBooking: vi.fn(),
          successRedirect: "/bookings",
          initialService: props.initialService,
        }),
      { initialProps: { initialService: services[1] } },
    );

    expect(result.current.selectedService?.id).toBe("b");

    act(() => {
      result.current.handleEditService();
    });
    expect(result.current.selectedService).toBeNull();

    rerender({ initialService: services[1] });
    expect(result.current.selectedService).toBeNull();
  });
});
```

- [ ] **Step 5: Run the test**

Run: `cd mini-app && bunx vitest run src/components/BookingForm/__tests__/useOnetimeBooking.test.ts`

Expected: both tests pass.

- [ ] **Step 6: Commit**

```bash
git add mini-app/src/components/BookingForm/useOnetimeBooking.ts mini-app/src/components/BookingForm/__tests__/useOnetimeBooking.test.ts
git commit -m "feat(booking-form): apply initialService in useOnetimeBooking hook"
```

---

## Task 6: Read `?service=` and `?date=` on the client `/book` page

**Files:**

- Modify: `mini-app/src/app/(client)/(activity)/book/page.tsx`

- [ ] **Step 1: Read both query params and pass them to `BookingForm`**

The file currently uses `ClientBookContent` wrapped in a `<Suspense>`. Replace the component body as follows.

Current imports (lines 1-11):

```tsx
"use client";

import { useTranslations } from "next-intl";
import { Suspense, useMemo } from "react";

import { BookingForm } from "@/components/BookingForm";
import {
  useBookings,
  useScheduleContext,
  useSessionTypes,
} from "@/hooks/queries";
import { api } from "@/lib/api";
import { getUserName } from "@/lib/telegram";

import type { ReactNode } from "react";
```

Change to:

```tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useMemo } from "react";

import { BookingForm } from "@/components/BookingForm";
import {
  useBookings,
  useScheduleContext,
  useSessionTypes,
} from "@/hooks/queries";
import { api } from "@/lib/api";
import { parseDateParam } from "@/lib/helpers";
import { getUserName } from "@/lib/telegram";

import type { ReactNode } from "react";
```

Locate the top of `ClientBookContent` (around line 32-69). After the existing `const { data: bookings } = useBookings();` line (~line 49), add:

```tsx
const searchParams = useSearchParams();
const initialDate = useMemo(
  () => parseDateParam(searchParams.get("date")),
  [searchParams],
);
const initialServiceId = searchParams.get("service");
const initialService = useMemo(
  () => services.find((s) => s.id === initialServiceId),
  [services, initialServiceId],
);
```

Then locate the `<BookingForm ... />` JSX (around line 72). The current props include `services`, `workingHours`, `daysOff`, `bookedDates`, `isLoading`, `showRecurring`, `successRedirect`, `title`, and three callback handlers. Add `initialDate` and `initialService` to the props:

```tsx
return (
  <BookingForm
    services={services}
    workingHours={workingHours}
    daysOff={daysOff}
    bookedDates={bookedDates}
    isLoading={scheduleLoading || svcLoading}
    showRecurring={false}
    successRedirect={"/bookings"}
    title={t("title")}
    initialDate={initialDate}
    initialService={initialService}
    onCreateBooking={async (params) => {
      const name = getUserName();
      await api.createBooking(
        params.duration,
        params.date,
        params.time,
        name,
        params.message,
        params.sessionTypeId,
      );
    }}
    onCreateRecurring={async (params) => {
      await api.createRecurringSchedule({
        sessionTypeId: params.sessionTypeId,
        dayTimes: params.dayTimes,
        period: params.period,
      });
    }}
    onPreviewRecurring={async (params) => {
      return api.previewRecurringSchedule({
        sessionTypeId: params.sessionTypeId,
        dayTimes: params.dayTimes,
        period: params.period,
      });
    }}
  />
);
```

(Only the props block changed — callbacks are identical.)

- [ ] **Step 2: Verify lint and tests**

Run:

```bash
cd mini-app && bun run lint && bunx vitest run
```

Expected: no new lint errors; all tests pass.

- [ ] **Step 3: Commit**

```bash
git add mini-app/src/app/(client)/(activity)/book/page.tsx
git commit -m "feat(client-book): preselect service and date from URL query params"
```

---

## Task 7: Split schedule groups and make modal items clickable

**Files:**

- Modify: `mini-app/src/app/(client)/page.tsx`

- [ ] **Step 1: Drop the group type and replace with per-day rows**

In `mini-app/src/app/(client)/page.tsx`, locate the `TScheduleGroup` type (around line 43-47):

```tsx
type TScheduleGroup = {
  dayLabel: string;
  hoursLabel: string;
  isClosed: boolean;
};
```

Replace with:

```tsx
type TScheduleRow = {
  day: number;
  dayLabel: string;
  hoursLabel: string;
  isClosed: boolean;
};
```

- [ ] **Step 2: Rewrite `scheduleGroups` as 7 independent rows**

Locate the `scheduleGroups` memo (around line 200-226):

```tsx
const scheduleGroups = useMemo((): TScheduleGroup[] => {
  const hoursByDay = new Map<number, TWorkingHours[]>();

  for (const item of workingHours) {
    const dayHours = hoursByDay.get(item.dayOfWeek) ?? [];
    dayHours.push(item);
    hoursByDay.set(item.dayOfWeek, dayHours);
  }

  return scheduleDayOrder.reduce<TScheduleGroup[]>((groups, day) => {
    const rawHoursLabel = getDayHoursLabel(hoursByDay.get(day.day) ?? []);
    const hoursLabel = rawHoursLabel || t("closed");
    const previousGroup = groups[groups.length - 1];

    if (previousGroup?.hoursLabel === hoursLabel) {
      previousGroup.dayLabel = `${previousGroup.dayLabel}-${tdays(day.key)}`;
      return groups;
    }

    groups.push({
      dayLabel: tdays(day.key),
      hoursLabel,
      isClosed: rawHoursLabel === "",
    });
    return groups;
  }, []);
}, [tdays, t, workingHours]);
```

Replace with:

```tsx
const scheduleRows = useMemo((): TScheduleRow[] => {
  const hoursByDay = new Map<number, TWorkingHours[]>();

  for (const item of workingHours) {
    const dayHours = hoursByDay.get(item.dayOfWeek) ?? [];
    dayHours.push(item);
    hoursByDay.set(item.dayOfWeek, dayHours);
  }

  return scheduleDayOrder.map((day) => {
    const rawHoursLabel = getDayHoursLabel(hoursByDay.get(day.day) ?? []);
    return {
      day: day.day,
      dayLabel: tdays(day.key),
      hoursLabel: rawHoursLabel || t("closed"),
      isClosed: rawHoursLabel === "",
    };
  });
}, [tdays, t, workingHours]);
```

- [ ] **Step 3: Import `Link` and `nextDateForWeekday`**

At the top of `mini-app/src/app/(client)/page.tsx`, in the imports block (lines 1-23), add `Link` from Next.js and `nextDateForWeekday` + `formatDateISO` from helpers. Locate the existing imports:

```tsx
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
```

Add:

```tsx
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
```

Locate the helpers import line (around line 19):

```tsx
import { formatDuration } from "@/lib/helpers";
```

Change to:

```tsx
import {
  formatDateISO,
  formatDuration,
  nextDateForWeekday,
} from "@/lib/helpers";
```

- [ ] **Step 4: Convert services modal items to `<Link>`**

Locate the services modal body (around line 594-646). The current content is:

```tsx
<BottomSheet
  isOpen={activeModal === 'services'}
  onClose={() => setActiveModal(null)}
  title={t('servicesButton')}
  className={'pb-6'}
>
  {services.length > 0 ? (
    <div className={'space-y-2'}>
      {services.map((service) => (
        <div
          key={service.id}
          className={'bg-background flex items-center gap-3 rounded-lg p-3'}
        >
          {/* ... icon + name + duration + price ... */}
        </div>
      ))}
    </div>
  ) : (
    /* empty state */
  )}
</BottomSheet>
```

Replace the outer `<div key={service.id}>` wrapper with a `<Link>`. Keep the inner content identical:

```tsx
<BottomSheet
  isOpen={activeModal === "services"}
  onClose={() => setActiveModal(null)}
  title={t("servicesButton")}
  className={"pb-6"}
>
  {services.length > 0 ? (
    <div className={"space-y-2"}>
      {services.map((service) => (
        <Link
          key={service.id}
          href={resolveTestAwareHref(pathname, `/book?service=${service.id}`)}
          onClick={() => setActiveModal(null)}
          className={
            "bg-background flex items-center gap-3 rounded-lg p-3 transition-opacity active:opacity-80"
          }
        >
          <div
            className={
              "bg-border flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg"
            }
          >
            {service.imageUrl ? (
              <Image
                width={48}
                height={48}
                src={getPhotoUrl(service.imageUrl)}
                alt={service.name}
                className={"h-full w-full object-cover"}
              />
            ) : (
              <CalendarCheck className={"text-muted-foreground h-5 w-5"} />
            )}
          </div>
          <div className={"min-w-0 flex-1"}>
            <p className={"text-foreground truncate text-sm font-medium"}>
              {service.name}
            </p>
            <div className={"mt-1 flex items-center gap-1"}>
              <Clock className={"text-muted-foreground h-3.5 w-3.5"} />
              <p className={"text-muted-foreground text-xs"}>
                {formatDuration(
                  service.durationMinutes,
                  td("hour"),
                  td("minutes"),
                )}
              </p>
            </div>
          </div>
          {service.price > 0 && (
            <p
              className={"text-foreground ml-2 shrink-0 text-sm font-semibold"}
            >
              {formatPrice(service.price, service.currency, locale)}
            </p>
          )}
        </Link>
      ))}
    </div>
  ) : (
    <div
      className={
        "bg-background text-muted-foreground rounded-lg p-4 text-center text-sm"
      }
    >
      {t("servicesEmpty")}
    </div>
  )}
</BottomSheet>
```

- [ ] **Step 5: Convert schedule modal rows**

Locate the schedule modal (around line 648-671). Current body:

```tsx
<BottomSheet
  isOpen={activeModal === "schedule"}
  onClose={() => setActiveModal(null)}
  title={t("scheduleTitle")}
  className={"pb-6"}
>
  <div className={"space-y-2"}>
    {scheduleGroups.map((group) => (
      <div
        key={`${group.dayLabel}-${group.hoursLabel}`}
        className={
          "bg-background flex items-center justify-between gap-4 rounded-lg p-3"
        }
      >
        <span className={"text-foreground text-sm font-medium"}>
          {group.dayLabel}
        </span>
        <span
          className={`text-right text-sm ${
            group.isClosed ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          {group.hoursLabel}
        </span>
      </div>
    ))}
  </div>
</BottomSheet>
```

Replace with:

```tsx
<BottomSheet
  isOpen={activeModal === "schedule"}
  onClose={() => setActiveModal(null)}
  title={t("scheduleTitle")}
  className={"pb-6"}
>
  <div className={"space-y-2"}>
    {scheduleRows.map((row) =>
      row.isClosed ? (
        <div
          key={row.day}
          className={
            "bg-background flex items-center justify-between gap-4 rounded-lg p-3"
          }
        >
          <span className={"text-foreground text-sm font-medium"}>
            {row.dayLabel}
          </span>
          <span className={"text-muted-foreground text-right text-sm"}>
            {row.hoursLabel}
          </span>
        </div>
      ) : (
        <Link
          key={row.day}
          href={resolveTestAwareHref(
            pathname,
            `/book?date=${formatDateISO(nextDateForWeekday(row.day, new Date()))}`,
          )}
          onClick={() => setActiveModal(null)}
          className={
            "bg-background flex items-center justify-between gap-4 rounded-lg p-3 transition-opacity active:opacity-80"
          }
        >
          <span className={"text-foreground text-sm font-medium"}>
            {row.dayLabel}
          </span>
          <span className={"text-foreground text-right text-sm"}>
            {row.hoursLabel}
          </span>
        </Link>
      ),
    )}
  </div>
</BottomSheet>
```

- [ ] **Step 6: Verify lint and tests**

Run:

```bash
cd mini-app && bun run lint && bunx vitest run
```

Expected: no lint errors; all tests pass.

- [ ] **Step 7: Build sanity-check**

Run: `cd mini-app && bun run build`

Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add mini-app/src/app/(client)/page.tsx
git commit -m "feat(client-home): make services and schedule modal items clickable"
```

---

## Task 8: Manual verification

- [ ] **Step 1: Start the dev server**

Run: `cd mini-app && bun dev`

- [ ] **Step 2: Services modal smoke test**

1. Open `http://localhost:3000` as a client (not specialist).
2. Tap "Услуги" (services button).
3. Tap any service row.
4. Expected: modal closes, route changes to `/book?service=<id>`, the service is preselected (its card is highlighted at the top, calendar is visible), auto-scroll lands on the date stage.

- [ ] **Step 3: Schedule modal smoke test**

1. Return to `/`.
2. Tap "Расписание" (schedule button).
3. Confirm all 7 rows are shown individually — no ranges like "Mon-Fri".
4. Tap an open (non-closed) row, e.g. Tuesday.
5. Expected: modal closes, route changes to `/book?date=YYYY-MM-DD` where the date is today if today is Tuesday or the next Tuesday otherwise.
6. On `/book`, pick a service; the date stage auto-populates with that Tuesday and time slots load.

- [ ] **Step 4: Closed day non-clickability**

1. Set one weekday to "closed" in specialist settings (admin side) if possible, otherwise find an already-closed day.
2. In the schedule modal, confirm the closed-day row is not styled as clickable and tapping it does nothing (renders as a plain `<div>`, not a link).

- [ ] **Step 5: Back button**

1. From `/book?service=X`, press the browser back button.
2. Expected: return to home page with modal closed (base state).

- [ ] **Step 6: If any step fails, file the bug and iterate; otherwise proceed.**

---

## Self-review notes

- Spec §1 (per-weekday rows) → Task 7 steps 1-2.
- Spec §2 (nextDateForWeekday) → Task 1.
- Spec §3a (lift parseDateParam) → Tasks 1 + 2.
- Spec §3b (client book reads params) → Task 6.
- Spec §3c-d (initialService plumbing + hook effect) → Tasks 3-5.
- Spec §3e (ordering / coexistence of initialService + initialDate effects) → implicitly covered; the `initialDate` effect already gates on `selectedService` and only fires once per date key.
- Spec §4 (Link-based items, closing modal on click) → Task 7 steps 4-5.
- Spec §5 (file-level summary) → matches tasks exactly.
- Spec §6 (testing) → Tasks 1 (helpers), 5 (hook test), 8 (manual).
- Spec §7 (non-goals) → no tasks, intentionally out of scope.

No placeholders. All code blocks are concrete. Type names match across tasks (`TScheduleRow`, `initialService`, `appliedInitialServiceKeyRef`). The `Link` + `formatDateISO` + `nextDateForWeekday` identifiers in Task 7 match Task 1's exports.
