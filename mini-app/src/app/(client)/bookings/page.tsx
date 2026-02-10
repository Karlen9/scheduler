"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CalendarX, ChevronDown, Repeat } from "lucide-react";
import { toast } from "sonner";
import { BookingCard } from "@/components/BookingCard";
import { WaitlistCard } from "@/components/WaitlistCard";
import { EmptyState } from "@/components/EmptyState";
import { BookingCardSkeleton } from "@/components/LoadingSkeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api } from "@/lib/api";
import { Booking, WaitlistEntry } from "@/lib/types";

export default function BookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [showPast, setShowPast] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [bookingsData, waitlistData] = await Promise.all([
        api.getBookings(),
        api.getWaitlist(),
      ]);
      setBookings(bookingsData);
      setWaitlist(waitlistData);
    } catch {
      setError("Не удалось загрузить записи");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeBookings = bookings.filter(
    (b) => b.status === "pending" || b.status === "confirmed",
  );
  const pastBookings = bookings.filter(
    (b) => b.status === "completed" || b.status === "cancelled" || b.status === "rejected",
  );

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await api.cancelBooking(cancelTarget.id, cancelReason || "Отменено клиентом");
      toast.success("Запись отменена");
      setCancelTarget(null);
      setCancelReason("");
      fetchData();
    } catch {
      toast.error("Не удалось отменить запись");
    }
  };

  const handleReschedule = (booking: Booking) => {
    const date = booking.startsAt.split("T")[0];
    const duration = booking.durationMinutes || booking.sessionType?.durationMinutes || 60;
    router.push(`/book?reschedule=${booking.id}&date=${date}&duration=${duration}`);
  };

  const handleWaitlistAccept = async (entry: WaitlistEntry) => {
    try {
      await api.acceptWaitlistOffer(entry.id);
      toast.success("Место забронировано!");
      fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Не удалось забронировать";
      toast.error(msg);
      fetchData();
    }
  };

  const handleWaitlistDecline = async (entry: WaitlistEntry) => {
    try {
      await api.declineWaitlistOffer(entry.id);
      toast.success("Вы отказались от предложения");
      fetchData();
    } catch {
      toast.error("Ошибка");
    }
  };

  const handleWaitlistLeave = async (entry: WaitlistEntry) => {
    try {
      await api.leaveWaitlist(entry.id);
      toast.success("Вы покинули очередь");
      fetchData();
    } catch {
      toast.error("Не удалось покинуть очередь");
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <h2 className="text-lg font-semibold px-1">Мои записи</h2>
        <div className="animate-pulse">
          <div className="h-4 bg-card rounded w-28 mb-3" />
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
            description={error}
          />
        </div>
      </div>
    );
  }

  if (bookings.length === 0 && waitlist.length === 0) {
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
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-semibold">Мои записи</h2>
          <button
            onClick={() => router.push("/recurring")}
            className="flex items-center gap-1.5 text-sm text-primary"
          >
            <Repeat className="w-4 h-4" />
            Расписание
          </button>
        </div>

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

        {waitlist.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Лист ожидания
            </h3>
            <div className="space-y-3">
              {waitlist.map((entry) => (
                <WaitlistCard
                  key={entry.id}
                  entry={entry}
                  onAccept={handleWaitlistAccept}
                  onDecline={handleWaitlistDecline}
                  onLeave={handleWaitlistLeave}
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
