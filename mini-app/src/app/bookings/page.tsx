"use client";

import { useState } from "react";
import { CalendarX } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BookingCard } from "@/components/BookingCard";
import { EmptyState } from "@/components/EmptyState";
import { BottomSafeArea } from "@/components/BottomSafeArea";
import { BookingCardSkeleton } from "@/components/LoadingSkeleton";

interface Booking {
  id: string;
  date: string;
  time: string;
  sessionType: string;
  location: string;
  status: "confirmed" | "cancelled";
}

const mockBookings: Booking[] = [
  {
    id: "1",
    date: "5 февраля 2026",
    time: "10:00 - 11:00",
    sessionType: "Персональная тренировка",
    location: 'Фитнес-клуб "Энергия"',
    status: "confirmed",
  },
  {
    id: "2",
    date: "8 февраля 2026",
    time: "14:00 - 14:45",
    sessionType: "Онлайн тренировка",
    location: "Онлайн",
    status: "confirmed",
  },
];

export default function BookingsPage() {
  const [bookings] = useState<Booking[]>(mockBookings);
  const [isLoading] = useState(false);

  const confirmedBookings = bookings.filter((b) => b.status === "confirmed");

  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-background"
        style={{ maxWidth: "430px", margin: "0 auto" }}
      >
        <TopBar title="Мои записи" showBack />
        <div className="p-4 space-y-3">
          <BookingCardSkeleton />
          <BookingCardSkeleton />
        </div>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div
        className="min-h-screen bg-background flex flex-col"
        style={{ maxWidth: "430px", margin: "0 auto" }}
      >
        <TopBar title="Мои записи" showBack />
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<CalendarX className="w-16 h-16" />}
            title="У вас пока нет записей"
            description="Выберите удобное время и запишитесь на тренировку"
          />
        </div>
        <BottomSafeArea />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background"
      style={{ maxWidth: "390px", margin: "0 auto" }}
    >
      <TopBar title="Мои записи" showBack />

      <div className="p-4 space-y-4">
        {confirmedBookings.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Активные записи
            </h3>
            <div className="space-y-3">
              {confirmedBookings.map((booking) => (
                <BookingCard key={booking.id} {...booking} />
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomSafeArea />
    </div>
  );
}
