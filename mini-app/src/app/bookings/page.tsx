"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarX } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BookingCard } from "@/components/BookingCard";
import { EmptyState } from "@/components/EmptyState";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
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
  {
    id: "3",
    date: "1 февраля 2026",
    time: "16:00 - 16:45",
    sessionType: "Растяжка",
    location: 'Фитнес-клуб "Энергия"',
    status: "cancelled",
  },
];

export default function BookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>(mockBookings);
  const [isLoading, setIsLoading] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<string | null>(null);

  const handleReschedule = (bookingId: string) => {
    // In a real app, you would pass the booking ID to the booking page
    router.push("/book");
  };

  const handleCancelClick = (bookingId: string) => {
    setBookingToCancel(bookingId);
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = () => {
    if (bookingToCancel) {
      setBookings(
        bookings.map((booking) =>
          booking.id === bookingToCancel
            ? { ...booking, status: "cancelled" as const }
            : booking,
        ),
      );
      setBookingToCancel(null);
    }
  };

  const confirmedBookings = bookings.filter((b) => b.status === "confirmed");
  const cancelledBookings = bookings.filter((b) => b.status === "cancelled");

  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-[var(--app-bg)]"
        style={{ maxWidth: "390px", margin: "0 auto" }}
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
        className="min-h-screen bg-[var(--app-bg)] flex flex-col"
        style={{ maxWidth: "390px", margin: "0 auto" }}
      >
        <TopBar title="Мои записи" showBack />
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<CalendarX className="w-16 h-16" />}
            title="У вас пока нет записей"
            description="Выберите удобное время и запишитесь на тренировку"
            action={
              <PrimaryButton onClick={() => router.push("/book")}>
                Записаться
              </PrimaryButton>
            }
          />
        </div>
        <BottomSafeArea />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[var(--app-bg)]"
      style={{ maxWidth: "390px", margin: "0 auto" }}
    >
      <TopBar title="Мои записи" showBack />

      <div className="p-4 space-y-4">
        {confirmedBookings.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-[var(--app-subtext)] mb-3">
              Активные записи
            </h3>
            <div className="space-y-3">
              {confirmedBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  {...booking}
                  onReschedule={() => handleReschedule(booking.id)}
                  onCancel={() => handleCancelClick(booking.id)}
                />
              ))}
            </div>
          </div>
        )}

        {cancelledBookings.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-[var(--app-subtext)] mb-3">
              Отмененные записи
            </h3>
            <div className="space-y-3">
              {cancelledBookings.map((booking) => (
                <BookingCard key={booking.id} {...booking} />
              ))}
            </div>
          </div>
        )}

        <div className="pt-4">
          <PrimaryButton onClick={() => router.push("/book")}>
            Новая запись
          </PrimaryButton>
        </div>
      </div>

      <ConfirmDialog
        isOpen={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        onConfirm={handleCancelConfirm}
        title="Отменить запись?"
        description="Вы уверены, что хотите отменить эту тренировку?"
        confirmText="Да, отменить"
        cancelText="Не отменять"
        destructive
      />

      <BottomSafeArea />
    </div>
  );
}
