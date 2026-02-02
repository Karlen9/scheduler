# Mini App UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete client-facing booking UI for the fitness scheduler Telegram Mini App in Russian.

**Architecture:** Next.js app with mock data layer. Pages for home, booking flow, and my bookings. Components for calendar, time slots, and booking cards. Mock API that can be swapped for real backend later.

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind CSS, Telegram Mini App SDK

---

### Task 1: Set Up Mock Data Layer

**Files:**
- Create: `mini-app/src/lib/mock-data.ts`
- Create: `mini-app/src/lib/types.ts`

**Step 1: Create TypeScript types**

Create `mini-app/src/lib/types.ts`:

```typescript
export interface Trainer {
  id: string;
  name: string;
  timezone: string;
  cancelCutoffHours: number;
}

export interface SessionType {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  currency: string;
}

export interface WorkingHours {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  startTime: string; // "09:00"
  endTime: string;   // "18:00"
}

export interface Booking {
  id: string;
  sessionType: SessionType;
  startsAt: string; // ISO datetime
  endsAt: string;
  status: "confirmed" | "cancelled" | "completed";
  cancelReason?: string;
  cancelledBy?: "client" | "trainer";
}

export interface TimeSlot {
  time: string; // "09:00"
  available: boolean;
}
```

**Step 2: Create mock data**

Create `mini-app/src/lib/mock-data.ts`:

```typescript
import { Trainer, SessionType, WorkingHours, Booking } from "./types";

export const mockTrainer: Trainer = {
  id: "trainer-1",
  name: "Алексей Петров",
  timezone: "Europe/Moscow",
  cancelCutoffHours: 24,
};

export const mockSessionTypes: SessionType[] = [
  {
    id: "st-1",
    name: "Персональная тренировка",
    durationMinutes: 60,
    price: 3000,
    currency: "RUB",
  },
  {
    id: "st-2",
    name: "Групповое занятие",
    durationMinutes: 90,
    price: 1500,
    currency: "RUB",
  },
  {
    id: "st-3",
    name: "Консультация",
    durationMinutes: 30,
    price: 1000,
    currency: "RUB",
  },
];

export const mockWorkingHours: WorkingHours[] = [
  { dayOfWeek: 1, startTime: "09:00", endTime: "18:00" },
  { dayOfWeek: 2, startTime: "09:00", endTime: "18:00" },
  { dayOfWeek: 3, startTime: "09:00", endTime: "18:00" },
  { dayOfWeek: 4, startTime: "09:00", endTime: "18:00" },
  { dayOfWeek: 5, startTime: "09:00", endTime: "18:00" },
  { dayOfWeek: 6, startTime: "10:00", endTime: "15:00" },
];

export const mockBookings: Booking[] = [
  {
    id: "b-1",
    sessionType: mockSessionTypes[0],
    startsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
    status: "confirmed",
  },
  {
    id: "b-2",
    sessionType: mockSessionTypes[1],
    startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000).toISOString(),
    status: "confirmed",
  },
];
```

**Step 3: Commit**

```bash
git add mini-app/src/lib/types.ts mini-app/src/lib/mock-data.ts
git commit -m "feat: add types and mock data for mini app"
```

---

### Task 2: Create Mock API Service

**Files:**
- Create: `mini-app/src/lib/api.ts`

**Step 1: Create API service with mock implementations**

Create `mini-app/src/lib/api.ts`:

```typescript
import {
  mockTrainer,
  mockSessionTypes,
  mockWorkingHours,
  mockBookings,
} from "./mock-data";
import { Trainer, SessionType, Booking, TimeSlot, WorkingHours } from "./types";

// Simulated delay for realistic feel
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let bookings = [...mockBookings];

export const api = {
  async getTrainer(): Promise<Trainer> {
    await delay(100);
    return mockTrainer;
  },

  async getSessionTypes(): Promise<SessionType[]> {
    await delay(100);
    return mockSessionTypes;
  },

  async getWorkingHours(): Promise<WorkingHours[]> {
    await delay(100);
    return mockWorkingHours;
  },

  async getAvailableSlots(date: string, sessionTypeId: string): Promise<TimeSlot[]> {
    await delay(200);

    const selectedDate = new Date(date);
    const dayOfWeek = selectedDate.getDay();
    const sessionType = mockSessionTypes.find((st) => st.id === sessionTypeId);
    const workingHour = mockWorkingHours.find((wh) => wh.dayOfWeek === dayOfWeek);

    if (!workingHour || !sessionType) {
      return [];
    }

    const slots: TimeSlot[] = [];
    const [startHour, startMin] = workingHour.startTime.split(":").map(Number);
    const [endHour, endMin] = workingHour.endTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    for (let minutes = startMinutes; minutes + sessionType.durationMinutes <= endMinutes; minutes += 30) {
      const hour = Math.floor(minutes / 60);
      const min = minutes % 60;
      const time = `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;

      // Check if slot conflicts with existing bookings
      const slotStart = new Date(date);
      slotStart.setHours(hour, min, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + sessionType.durationMinutes * 60 * 1000);

      const hasConflict = bookings.some((booking) => {
        if (booking.status === "cancelled") return false;
        const bookingStart = new Date(booking.startsAt);
        const bookingEnd = new Date(booking.endsAt);
        return slotStart < bookingEnd && slotEnd > bookingStart;
      });

      slots.push({ time, available: !hasConflict });
    }

    return slots;
  },

  async getBookings(): Promise<Booking[]> {
    await delay(100);
    return bookings.filter((b) => b.status === "confirmed");
  },

  async createBooking(sessionTypeId: string, date: string, time: string): Promise<Booking> {
    await delay(300);

    const sessionType = mockSessionTypes.find((st) => st.id === sessionTypeId)!;
    const [hour, min] = time.split(":").map(Number);
    const startsAt = new Date(date);
    startsAt.setHours(hour, min, 0, 0);
    const endsAt = new Date(startsAt.getTime() + sessionType.durationMinutes * 60 * 1000);

    const newBooking: Booking = {
      id: `b-${Date.now()}`,
      sessionType,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      status: "confirmed",
    };

    bookings.push(newBooking);
    return newBooking;
  },

  async cancelBooking(bookingId: string, reason: string): Promise<Booking> {
    await delay(200);

    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) throw new Error("Booking not found");

    booking.status = "cancelled";
    booking.cancelReason = reason;
    booking.cancelledBy = "client";

    return booking;
  },

  async rescheduleBooking(bookingId: string, date: string, time: string, reason: string): Promise<Booking> {
    await delay(300);

    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) throw new Error("Booking not found");

    const [hour, min] = time.split(":").map(Number);
    const startsAt = new Date(date);
    startsAt.setHours(hour, min, 0, 0);
    const endsAt = new Date(startsAt.getTime() + booking.sessionType.durationMinutes * 60 * 1000);

    booking.startsAt = startsAt.toISOString();
    booking.endsAt = endsAt.toISOString();

    return booking;
  },
};
```

**Step 2: Commit**

```bash
git add mini-app/src/lib/api.ts
git commit -m "feat: add mock API service"
```

---

### Task 3: Create Telegram SDK Helper

**Files:**
- Create: `mini-app/src/lib/telegram.ts`

**Step 1: Create Telegram helper**

Create `mini-app/src/lib/telegram.ts`:

```typescript
export interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  MainButton: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
  };
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
  };
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window !== "undefined" && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

export function initTelegramApp() {
  const webApp = getTelegramWebApp();
  if (webApp) {
    webApp.ready();
    webApp.expand();
  }
}

export function getThemeParams() {
  const webApp = getTelegramWebApp();
  return webApp?.themeParams ?? {
    bg_color: "#ffffff",
    text_color: "#000000",
    hint_color: "#999999",
    link_color: "#2678b6",
    button_color: "#2678b6",
    button_text_color: "#ffffff",
    secondary_bg_color: "#f0f0f0",
  };
}

export function getUserName(): string {
  const webApp = getTelegramWebApp();
  const user = webApp?.initDataUnsafe?.user;
  if (user) {
    return user.first_name + (user.last_name ? ` ${user.last_name}` : "");
  }
  return "Гость";
}
```

**Step 2: Commit**

```bash
git add mini-app/src/lib/telegram.ts
git commit -m "feat: add Telegram SDK helper"
```

---

### Task 4: Create Shared UI Components

**Files:**
- Create: `mini-app/src/components/Button.tsx`
- Create: `mini-app/src/components/Card.tsx`
- Create: `mini-app/src/components/Loading.tsx`

**Step 1: Create Button component**

Create `mini-app/src/components/Button.tsx`:

```typescript
"use client";

import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = "primary",
  fullWidth = false,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = "px-4 py-3 rounded-lg font-medium transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-[var(--tg-theme-button-color)] text-[var(--tg-theme-button-text-color)]",
    secondary: "bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)]",
    danger: "bg-red-500 text-white",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
```

**Step 2: Create Card component**

Create `mini-app/src/components/Card.tsx`:

```typescript
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
```

**Step 3: Create Loading component**

Create `mini-app/src/components/Loading.tsx`:

```typescript
"use client";

export function Loading() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="w-8 h-8 border-2 border-[var(--tg-theme-button-color)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add mini-app/src/components/
git commit -m "feat: add shared UI components"
```

---

### Task 5: Create Calendar Component

**Files:**
- Create: `mini-app/src/components/Calendar.tsx`

**Step 1: Create Calendar component**

Create `mini-app/src/components/Calendar.tsx`:

```typescript
"use client";

import { useState, useMemo } from "react";

interface CalendarProps {
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  workingDays: number[]; // 0-6, days when trainer works
}

const DAYS_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

export function Calendar({ selectedDate, onSelectDate, workingDays }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const days = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();

    const result: { date: Date; isCurrentMonth: boolean; isDisabled: boolean }[] = [];

    // Previous month padding
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      result.push({ date, isCurrentMonth: false, isDisabled: true });
    }

    // Current month
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const isPast = date < today;
      const isWorkingDay = workingDays.includes(date.getDay());
      result.push({
        date,
        isCurrentMonth: true,
        isDisabled: isPast || !isWorkingDay,
      });
    }

    // Next month padding
    const remaining = 7 - (result.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const date = new Date(year, month + 1, i);
        result.push({ date, isCurrentMonth: false, isDisabled: true });
      }
    }

    return result;
  }, [currentMonth, workingDays]);

  const goToPrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const formatDateString = (date: Date): string => {
    return date.toISOString().split("T")[0];
  };

  const canGoPrev = useMemo(() => {
    const today = new Date();
    return currentMonth.getFullYear() > today.getFullYear() ||
      (currentMonth.getFullYear() === today.getFullYear() && currentMonth.getMonth() > today.getMonth());
  }, [currentMonth]);

  return (
    <div className="select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPrevMonth}
          disabled={!canGoPrev}
          className="p-2 rounded-lg disabled:opacity-30"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="font-semibold text-lg">
          {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </span>
        <button onClick={goToNextMonth} className="p-2 rounded-lg">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAYS_SHORT.map((day) => (
          <div key={day} className="text-center text-sm text-[var(--tg-theme-hint-color)] py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(({ date, isCurrentMonth, isDisabled }, index) => {
          const dateString = formatDateString(date);
          const isSelected = selectedDate === dateString;
          const isToday = formatDateString(new Date()) === dateString;

          return (
            <button
              key={index}
              onClick={() => !isDisabled && onSelectDate(dateString)}
              disabled={isDisabled}
              className={`
                aspect-square flex items-center justify-center rounded-lg text-sm transition-all
                ${!isCurrentMonth ? "text-[var(--tg-theme-hint-color)] opacity-30" : ""}
                ${isDisabled && isCurrentMonth ? "text-[var(--tg-theme-hint-color)] opacity-50" : ""}
                ${!isDisabled && !isSelected ? "active:scale-95" : ""}
                ${isSelected ? "bg-[var(--tg-theme-button-color)] text-[var(--tg-theme-button-text-color)]" : ""}
                ${isToday && !isSelected ? "ring-1 ring-[var(--tg-theme-button-color)]" : ""}
              `}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add mini-app/src/components/Calendar.tsx
git commit -m "feat: add Calendar component"
```

---

### Task 6: Create TimeSlots Component

**Files:**
- Create: `mini-app/src/components/TimeSlots.tsx`

**Step 1: Create TimeSlots component**

Create `mini-app/src/components/TimeSlots.tsx`:

```typescript
"use client";

import { TimeSlot } from "@/lib/types";

interface TimeSlotsProps {
  slots: TimeSlot[];
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
  isLoading?: boolean;
}

export function TimeSlots({ slots, selectedTime, onSelectTime, isLoading }: TimeSlotsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-[var(--tg-theme-button-color)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--tg-theme-hint-color)]">
        Нет доступного времени
      </div>
    );
  }

  const availableSlots = slots.filter((s) => s.available);

  if (availableSlots.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--tg-theme-hint-color)]">
        Все время занято на этот день
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {slots.map((slot) => (
        <button
          key={slot.time}
          onClick={() => slot.available && onSelectTime(slot.time)}
          disabled={!slot.available}
          className={`
            py-3 px-2 rounded-lg text-sm font-medium transition-all
            ${!slot.available ? "opacity-30 line-through cursor-not-allowed" : "active:scale-95"}
            ${selectedTime === slot.time
              ? "bg-[var(--tg-theme-button-color)] text-[var(--tg-theme-button-text-color)]"
              : "bg-[var(--tg-theme-secondary-bg-color)]"
            }
          `}
        >
          {slot.time}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add mini-app/src/components/TimeSlots.tsx
git commit -m "feat: add TimeSlots component"
```

---

### Task 7: Create BookingCard Component

**Files:**
- Create: `mini-app/src/components/BookingCard.tsx`

**Step 1: Create BookingCard component**

Create `mini-app/src/components/BookingCard.tsx`:

```typescript
"use client";

import { Booking } from "@/lib/types";
import { Card } from "./Card";
import { Button } from "./Button";

interface BookingCardProps {
  booking: Booking;
  onReschedule: (booking: Booking) => void;
  onCancel: (booking: Booking) => void;
  canModify: boolean;
}

const DAYS = ["воскресенье", "понедельник", "вторник", "среду", "четверг", "пятницу", "субботу"];
const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"
];

function formatDateTime(isoString: string): { date: string; time: string; dayName: string } {
  const d = new Date(isoString);
  const day = d.getDate();
  const month = MONTHS_GENITIVE[d.getMonth()];
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");

  return {
    date: `${day} ${month}`,
    time: `${hours}:${minutes}`,
    dayName: DAYS[d.getDay()],
  };
}

function formatPrice(price: number, currency: string): string {
  if (currency === "RUB") {
    return `${price.toLocaleString("ru-RU")} руб.`;
  }
  return `${price} ${currency}`;
}

export function BookingCard({ booking, onReschedule, onCancel, canModify }: BookingCardProps) {
  const { date, time, dayName } = formatDateTime(booking.startsAt);

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="font-semibold text-lg">{booking.sessionType.name}</h3>
          <p className="text-[var(--tg-theme-hint-color)] text-sm">
            {booking.sessionType.durationMinutes} мин. | {formatPrice(booking.sessionType.price, booking.sessionType.currency)}
          </p>
        </div>

        <div className="flex items-center gap-2 text-[var(--tg-theme-text-color)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <span>{date}, {dayName}</span>
        </div>

        <div className="flex items-center gap-2 text-[var(--tg-theme-text-color)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span>{time}</span>
        </div>

        {canModify ? (
          <div className="flex gap-2 mt-2">
            <Button
              variant="secondary"
              onClick={() => onReschedule(booking)}
              className="flex-1"
            >
              Перенести
            </Button>
            <Button
              variant="danger"
              onClick={() => onCancel(booking)}
              className="flex-1"
            >
              Отменить
            </Button>
          </div>
        ) : (
          <p className="text-sm text-[var(--tg-theme-hint-color)] mt-2">
            Изменение невозможно (менее 24ч до начала)
          </p>
        )}
      </div>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add mini-app/src/components/BookingCard.tsx
git commit -m "feat: add BookingCard component"
```

---

### Task 8: Create Home Page

**Files:**
- Modify: `mini-app/src/app/page.tsx`
- Modify: `mini-app/src/app/layout.tsx`
- Modify: `mini-app/src/app/globals.css`

**Step 1: Update globals.css**

Replace content of `mini-app/src/app/globals.css`:

```css
@import "tailwindcss";

:root {
  --tg-theme-bg-color: #ffffff;
  --tg-theme-text-color: #000000;
  --tg-theme-hint-color: #999999;
  --tg-theme-link-color: #2678b6;
  --tg-theme-button-color: #2678b6;
  --tg-theme-button-text-color: #ffffff;
  --tg-theme-secondary-bg-color: #f0f0f0;
}

* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

html,
body {
  max-width: 100vw;
  overflow-x: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

body {
  background-color: var(--tg-theme-bg-color);
  color: var(--tg-theme-text-color);
}
```

**Step 2: Update layout.tsx**

Replace content of `mini-app/src/app/layout.tsx`:

```typescript
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Расписание тренировок",
  description: "Запись на тренировки",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
```

**Step 3: Update home page**

Replace content of `mini-app/src/app/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { initTelegramApp, getUserName, getThemeParams } from "@/lib/telegram";
import { api } from "@/lib/api";
import { Trainer } from "@/lib/types";
import { Button } from "@/components/Button";
import { Loading } from "@/components/Loading";

export default function Home() {
  const router = useRouter();
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initTelegramApp();

    // Apply Telegram theme
    const params = getThemeParams();
    const root = document.documentElement;
    if (params.bg_color) root.style.setProperty("--tg-theme-bg-color", params.bg_color);
    if (params.text_color) root.style.setProperty("--tg-theme-text-color", params.text_color);
    if (params.hint_color) root.style.setProperty("--tg-theme-hint-color", params.hint_color);
    if (params.link_color) root.style.setProperty("--tg-theme-link-color", params.link_color);
    if (params.button_color) root.style.setProperty("--tg-theme-button-color", params.button_color);
    if (params.button_text_color) root.style.setProperty("--tg-theme-button-text-color", params.button_text_color);
    if (params.secondary_bg_color) root.style.setProperty("--tg-theme-secondary-bg-color", params.secondary_bg_color);

    // Load trainer info
    api.getTrainer().then((t) => {
      setTrainer(t);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  const userName = getUserName();

  return (
    <div className="min-h-screen p-4 flex flex-col">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[var(--tg-theme-hint-color)] text-sm">Добро пожаловать, {userName}</p>
        <h1 className="text-2xl font-bold mt-1">Тренер {trainer?.name}</h1>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-4 flex-1">
        <Button fullWidth onClick={() => router.push("/book")}>
          Записаться на тренировку
        </Button>

        <Button fullWidth variant="secondary" onClick={() => router.push("/bookings")}>
          Мои записи
        </Button>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-8 text-center text-[var(--tg-theme-hint-color)] text-sm">
        Отмена и перенос возможны за {trainer?.cancelCutoffHours}ч до начала
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add mini-app/src/app/
git commit -m "feat: update home page with Russian UI"
```

---

### Task 9: Create Booking Flow Page

**Files:**
- Create: `mini-app/src/app/book/page.tsx`

**Step 1: Create booking page**

Create directory and file `mini-app/src/app/book/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { SessionType, TimeSlot, WorkingHours } from "@/lib/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Calendar } from "@/components/Calendar";
import { TimeSlots } from "@/components/TimeSlots";
import { Loading } from "@/components/Loading";
import { getTelegramWebApp } from "@/lib/telegram";

type Step = "service" | "date" | "time" | "confirm";

export default function BookPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("service");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [sessionTypes, setSessionTypes] = useState<SessionType[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [selectedService, setSelectedService] = useState<SessionType | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  useEffect(() => {
    const webApp = getTelegramWebApp();
    webApp?.BackButton.show();

    const handleBack = () => {
      if (step === "service") {
        router.push("/");
      } else if (step === "date") {
        setStep("service");
      } else if (step === "time") {
        setStep("date");
      } else if (step === "confirm") {
        setStep("time");
      }
    };

    webApp?.BackButton.onClick(handleBack);

    return () => {
      webApp?.BackButton.offClick(handleBack);
      webApp?.BackButton.hide();
    };
  }, [step, router]);

  useEffect(() => {
    Promise.all([api.getSessionTypes(), api.getWorkingHours()]).then(
      ([types, hours]) => {
        setSessionTypes(types);
        setWorkingHours(hours);
        setIsLoading(false);
      }
    );
  }, []);

  useEffect(() => {
    if (selectedDate && selectedService) {
      setSlotsLoading(true);
      api.getAvailableSlots(selectedDate, selectedService.id).then((s) => {
        setSlots(s);
        setSlotsLoading(false);
      });
    }
  }, [selectedDate, selectedService]);

  const handleSelectService = (service: SessionType) => {
    setSelectedService(service);
    setStep("date");
  };

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setSelectedTime(null);
    setStep("time");
  };

  const handleSelectTime = (time: string) => {
    setSelectedTime(time);
    setStep("confirm");
  };

  const handleConfirm = async () => {
    if (!selectedService || !selectedDate || !selectedTime) return;

    setIsSubmitting(true);
    try {
      await api.createBooking(selectedService.id, selectedDate, selectedTime);
      router.push("/bookings?success=1");
    } catch (error) {
      console.error("Booking failed:", error);
      setIsSubmitting(false);
    }
  };

  const formatPrice = (price: number, currency: string): string => {
    if (currency === "RUB") {
      return `${price.toLocaleString("ru-RU")} руб.`;
    }
    return `${price} ${currency}`;
  };

  const formatSelectedDate = (): string => {
    if (!selectedDate) return "";
    const d = new Date(selectedDate);
    const MONTHS = [
      "января", "февраля", "марта", "апреля", "мая", "июня",
      "июля", "августа", "сентября", "октября", "ноября", "декабря"
    ];
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };

  const workingDays = workingHours.map((wh) => wh.dayOfWeek);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      {/* Step: Select Service */}
      {step === "service" && (
        <>
          <h1 className="text-xl font-bold mb-4">Выберите услугу</h1>
          <div className="flex flex-col gap-3">
            {sessionTypes.map((service) => (
              <Card key={service.id} onClick={() => handleSelectService(service)}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{service.name}</h3>
                    <p className="text-sm text-[var(--tg-theme-hint-color)]">
                      {service.durationMinutes} мин.
                    </p>
                  </div>
                  <span className="font-semibold">
                    {formatPrice(service.price, service.currency)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Step: Select Date */}
      {step === "date" && (
        <>
          <h1 className="text-xl font-bold mb-1">Выберите дату</h1>
          <p className="text-sm text-[var(--tg-theme-hint-color)] mb-4">
            {selectedService?.name}
          </p>
          <Calendar
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            workingDays={workingDays}
          />
        </>
      )}

      {/* Step: Select Time */}
      {step === "time" && (
        <>
          <h1 className="text-xl font-bold mb-1">Выберите время</h1>
          <p className="text-sm text-[var(--tg-theme-hint-color)] mb-4">
            {selectedService?.name}, {formatSelectedDate()}
          </p>
          <TimeSlots
            slots={slots}
            selectedTime={selectedTime}
            onSelectTime={handleSelectTime}
            isLoading={slotsLoading}
          />
        </>
      )}

      {/* Step: Confirm */}
      {step === "confirm" && selectedService && (
        <>
          <h1 className="text-xl font-bold mb-4">Подтверждение</h1>
          <Card>
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm text-[var(--tg-theme-hint-color)]">Услуга</p>
                <p className="font-semibold">{selectedService.name}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--tg-theme-hint-color)]">Дата и время</p>
                <p className="font-semibold">{formatSelectedDate()}, {selectedTime}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--tg-theme-hint-color)]">Длительность</p>
                <p className="font-semibold">{selectedService.durationMinutes} мин.</p>
              </div>
              <div>
                <p className="text-sm text-[var(--tg-theme-hint-color)]">Стоимость</p>
                <p className="font-semibold">{formatPrice(selectedService.price, selectedService.currency)}</p>
              </div>
            </div>
          </Card>

          <div className="mt-6">
            <Button fullWidth onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? "Записываем..." : "Подтвердить запись"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
mkdir -p mini-app/src/app/book
git add mini-app/src/app/book/
git commit -m "feat: add booking flow page"
```

---

### Task 10: Create My Bookings Page

**Files:**
- Create: `mini-app/src/app/bookings/page.tsx`

**Step 1: Create bookings page**

Create directory and file `mini-app/src/app/bookings/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Booking, Trainer } from "@/lib/types";
import { BookingCard } from "@/components/BookingCard";
import { Loading } from "@/components/Loading";
import { getTelegramWebApp } from "@/lib/telegram";

export default function BookingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  const [cancelModal, setCancelModal] = useState<Booking | null>(null);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const webApp = getTelegramWebApp();
    webApp?.BackButton.show();

    const handleBack = () => {
      router.push("/");
    };

    webApp?.BackButton.onClick(handleBack);

    return () => {
      webApp?.BackButton.offClick(handleBack);
      webApp?.BackButton.hide();
    };
  }, [router]);

  useEffect(() => {
    if (searchParams.get("success") === "1") {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  }, [searchParams]);

  useEffect(() => {
    Promise.all([api.getBookings(), api.getTrainer()]).then(([b, t]) => {
      setBookings(b);
      setTrainer(t);
      setIsLoading(false);
    });
  }, []);

  const canModifyBooking = (booking: Booking): boolean => {
    if (!trainer) return false;
    const cutoffMs = trainer.cancelCutoffHours * 60 * 60 * 1000;
    const startsAt = new Date(booking.startsAt).getTime();
    const now = Date.now();
    return startsAt - now > cutoffMs;
  };

  const handleCancel = async () => {
    if (!cancelModal) return;
    setIsSubmitting(true);

    try {
      await api.cancelBooking(cancelModal.id, cancelReason);
      setBookings((prev) => prev.filter((b) => b.id !== cancelModal.id));
      setCancelModal(null);
      setCancelReason("");
    } catch (error) {
      console.error("Cancel failed:", error);
    }

    setIsSubmitting(false);
  };

  const handleReschedule = (booking: Booking) => {
    // Store booking to reschedule and navigate to booking flow
    sessionStorage.setItem("rescheduleBooking", JSON.stringify(booking));
    router.push("/book?reschedule=1");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <h1 className="text-xl font-bold mb-4">Мои записи</h1>

      {/* Success message */}
      {showSuccess && (
        <div className="mb-4 p-3 rounded-lg bg-green-100 text-green-800">
          Запись успешно создана
        </div>
      )}

      {/* Bookings list */}
      {bookings.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[var(--tg-theme-hint-color)] mb-4">
            У вас пока нет записей
          </p>
          <button
            onClick={() => router.push("/book")}
            className="text-[var(--tg-theme-link-color)] font-medium"
          >
            Записаться на тренировку
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              canModify={canModifyBooking(booking)}
              onCancel={(b) => setCancelModal(b)}
              onReschedule={handleReschedule}
            />
          ))}
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div
            className="w-full max-w-lg rounded-t-2xl p-4"
            style={{ backgroundColor: "var(--tg-theme-bg-color)" }}
          >
            <h2 className="text-lg font-bold mb-4">Отмена записи</h2>
            <p className="text-[var(--tg-theme-hint-color)] mb-4">
              {cancelModal.sessionType.name}
            </p>

            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Причина отмены (необязательно)"
              className="w-full p-3 rounded-lg border mb-4 bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)] resize-none"
              rows={3}
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setCancelModal(null);
                  setCancelReason("");
                }}
                className="flex-1 py-3 rounded-lg bg-[var(--tg-theme-secondary-bg-color)]"
              >
                Назад
              </button>
              <button
                onClick={handleCancel}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-lg bg-red-500 text-white disabled:opacity-50"
              >
                {isSubmitting ? "Отмена..." : "Отменить запись"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
mkdir -p mini-app/src/app/bookings
git add mini-app/src/app/bookings/
git commit -m "feat: add my bookings page"
```

---

### Task 11: Create Components Index

**Files:**
- Create: `mini-app/src/components/index.ts`

**Step 1: Create index file**

Create `mini-app/src/components/index.ts`:

```typescript
export { Button } from "./Button";
export { Card } from "./Card";
export { Loading } from "./Loading";
export { Calendar } from "./Calendar";
export { TimeSlots } from "./TimeSlots";
export { BookingCard } from "./BookingCard";
```

**Step 2: Commit**

```bash
git add mini-app/src/components/index.ts
git commit -m "feat: add components index"
```

---

### Task 12: Final Testing

**Step 1: Install dependencies and run dev server**

```bash
cd mini-app && bun install
```

**Step 2: Start dev server**

```bash
cd mini-app && bun dev
```

**Step 3: Manual testing checklist**

- [ ] Home page loads with trainer name
- [ ] "Записаться на тренировку" navigates to /book
- [ ] Service selection works
- [ ] Calendar shows only working days as selectable
- [ ] Time slots load for selected date
- [ ] Booking confirmation shows correct details
- [ ] After booking, redirects to /bookings with success message
- [ ] Bookings list shows created booking
- [ ] Cancel modal opens and works
- [ ] Reschedule button works

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete mini app UI for fitness scheduler"
```
