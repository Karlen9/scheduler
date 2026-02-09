"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CalendarX } from "lucide-react";
import { toast } from "sonner";
import { BookingCard } from "@/components/BookingCard";
import { EmptyState } from "@/components/EmptyState";
import { BookingCardSkeleton } from "@/components/LoadingSkeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api } from "@/lib/api";
import { Booking } from "@/lib/types";

export default function BookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);

  const fetchBookings = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getBookings();
      setBookings(data);
    } catch {
      setError("Не удалось загрузить записи");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const activeBookings = bookings.filter(
    (b) => b.status === "pending" || b.status === "confirmed",
  );
  const pastBookings = bookings.filter(
    (b) => b.status === "completed" || b.status === "cancelled" || b.status === "rejected",
  );

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await api.cancelBooking(cancelTarget.id, "Отменено клиентом");
      toast.success("Запись отменена");
      setCancelTarget(null);
      fetchBookings();
    } catch {
      toast.error("Не удалось отменить запись");
    }
  };

  const handleReschedule = (booking: Booking) => {
    const date = booking.startsAt.split("T")[0];
    router.push(`/book?reschedule=${booking.id}&date=${date}&sessionType=${booking.sessionType?.type || "personal"}`);
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <h2 className="text-lg font-semibold px-1">Мои записи</h2>
        <BookingCardSkeleton />
        <BookingCardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="p-4">
          <h2 className="text-lg font-semibold px-1">Мои записи</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<CalendarX className="w-16 h-16" />}
            title="Ошибка загрузки"
            description={error}
          />
        </div>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="p-4">
          <h2 className="text-lg font-semibold px-1">Мои записи</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<CalendarX className="w-16 h-16" />}
            title="У вас пока нет записей"
            description="Выберите удобное время и запишитесь на тренировку"
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="p-4 space-y-4">
        <h2 className="text-lg font-semibold px-1">Мои записи</h2>

        {activeBookings.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Активные записи
            </h3>
            <div className="space-y-3">
              {activeBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onReschedule={handleReschedule}
                  onCancel={setCancelTarget}
                />
              ))}
            </div>
          </div>
        )}

        {pastBookings.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Прошедшие записи
            </h3>
            <div className="space-y-3">
              {pastBookings.map((booking) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        title="Отменить запись?"
        description="Вы уверены, что хотите отменить эту запись? Это действие нельзя отменить."
        confirmText="Отменить запись"
        destructive
      />
    </div>
  );
}
