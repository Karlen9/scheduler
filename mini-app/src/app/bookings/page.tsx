"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Booking, Trainer } from "@/lib/types";
import { BookingCard } from "@/components/BookingCard";
import { Loading } from "@/components/Loading";
import { getTelegramWebApp } from "@/lib/telegram";

function BookingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  const [cancelModal, setCancelModal] = useState<Booking | null>(null);
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
    <div className="min-h-screen p-6 bg-gradient-to-b from-blue-50 to-white">
      <h1 className="text-2xl font-bold mb-6">Мои записи</h1>

      {/* Success message */}
      {showSuccess && (
        <div className="mb-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
          <p className="text-blue-800 font-medium">Заявка отправлена!</p>
          <p className="text-blue-600 text-sm mt-1">Ожидайте подтверждения от тренера</p>
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

export default function BookingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loading /></div>}>
      <BookingsContent />
    </Suspense>
  );
}
