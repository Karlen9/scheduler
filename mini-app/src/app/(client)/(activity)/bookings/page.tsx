"use client";

import { useState } from "react";
import { CalendarX, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { BookingCard } from "@/components/BookingCard";
import { EmptyState } from "@/components/EmptyState";
import { BookingCardSkeleton } from "@/components/LoadingSkeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api } from "@/lib/api";
import { Booking } from "@/lib/types";
import { useBookings } from "@/hooks/queries";
import { invalidateBookings } from "@/hooks/mutations";

export default function BookingsPage() {
  const { data: bookings, isLoading, error } = useBookings();
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [showPast, setShowPast] = useState(false);

  const activeBookings = bookings
    .filter((b) => b.status === "pending" || b.status === "confirmed" || b.status === "cancel_requested" || b.status === "reschedule_pending")
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const pastBookings = bookings
    .filter((b) => b.status === "completed" || b.status === "cancelled" || b.status === "rejected")
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await api.cancelBooking(cancelTarget.id, cancelReason || "Отменено клиентом");
      toast.success("Запись отменена");
      setCancelTarget(null);
      setCancelReason("");
      invalidateBookings();
    } catch {
      toast.error("Не удалось отменить запись");
    }
  };

  const handleConfirm = async (booking: Booking) => {
    try {
      await api.confirmBooking(booking.id);
      toast.success("Запись подтверждена");
      invalidateBookings();
    } catch {
      toast.error("Не удалось подтвердить запись");
    }
  };

  const handleDecline = async (booking: Booking) => {
    try {
      await api.declineBooking(booking.id);
      toast.success("Запись отклонена");
      invalidateBookings();
    } catch {
      toast.error("Не удалось отклонить запись");
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <h2 className="text-lg font-semibold px-1">Мои записи</h2>
        <div>
          <div className="h-4 bg-card rounded w-28 mb-3 animate-pulse" />
          <div className="space-y-3">
            <BookingCardSkeleton />
            <BookingCardSkeleton />
          </div>
        </div>
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
            description="Не удалось загрузить записи"
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
                  onCancel={setCancelTarget}
                  onConfirm={booking.status === "pending" && booking.createdBy === "trainer" ? handleConfirm : undefined}
                  onDecline={booking.status === "pending" && booking.createdBy === "trainer" ? handleDecline : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {pastBookings.length > 0 && (
          <div>
            <button
              onClick={() => setShowPast(!showPast)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showPast ? "rotate-0" : "-rotate-90"}`} />
              Прошедшие записи ({pastBookings.length})
            </button>
            {showPast && (
              <div className="space-y-3">
                {pastBookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!cancelTarget}
        onClose={() => { setCancelTarget(null); setCancelReason(""); }}
        onConfirm={handleCancel}
        title="Отменить запись?"
        description="Вы уверены, что хотите отменить эту запись? Это действие нельзя отменить."
        confirmText="Отменить запись"
        destructive
        showInput
        inputPlaceholder="Причина отмены (необязательно)"
        inputValue={cancelReason}
        onInputChange={setCancelReason}
      />
    </div>
  );
}
