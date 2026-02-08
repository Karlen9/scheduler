"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { PendingBookingCard } from "@/components/PendingBookingCard";
import { UpcomingBookingCard } from "@/components/UpcomingBookingCard";
import { BookingDetailModal } from "@/components/BookingDetailModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { Booking } from "@/lib/types";
import { api } from "@/lib/api";

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Booking | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.admin.getBookings();
      setBookings(data);
    } catch (err) {
      console.error("Failed to fetch bookings:", err);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const now = new Date();

  const pendingBookings = bookings
    .filter((b) => b.status === "pending")
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const upcomingBookings = bookings
    .filter((b) => b.status === "confirmed" && new Date(b.startsAt) > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const handleAccept = async (booking: Booking) => {
    try {
      await api.admin.updateBookingStatus(booking.id, "confirmed");
      toast.success("Запись подтверждена");
      await fetchData();
    } catch (err) {
      console.error("Failed to accept booking:", err);
      toast.error("Не удалось подтвердить запись");
    }
  };

  const handleRejectClick = (booking: Booking) => {
    setRejectTarget(booking);
    setShowRejectDialog(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectTarget) return;
    try {
      await api.admin.updateBookingStatus(rejectTarget.id, "rejected");
      toast.success("Запись отклонена");
      await fetchData();
    } catch (err) {
      console.error("Failed to reject booking:", err);
      toast.error("Не удалось отклонить запись");
    }
    setShowRejectDialog(false);
    setRejectTarget(null);
  };

  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking);
  };

  const handleCancelClick = () => {
    setShowCancelDialog(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedBooking) return;
    try {
      await api.admin.updateBookingStatus(selectedBooking.id, "cancelled");
      toast.success("Запись отменена");
      await fetchData();
    } catch (err) {
      console.error("Failed to cancel booking:", err);
      toast.error("Не удалось отменить запись");
    }
    setShowCancelDialog(false);
    setSelectedBooking(null);
  };

  if (loading) {
    return (
      <div className="p-4 flex justify-center items-center min-h-[200px]">
        <div className="text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-900/20 text-red-400 p-4 rounded-xl text-center">
          {error}
        </div>
      </div>
    );
  }

  const isEmpty = pendingBookings.length === 0 && upcomingBookings.length === 0;

  return (
    <div className="p-4">
      {isEmpty ? (
        <EmptyState
          icon={<ClipboardList className="w-16 h-16" />}
          title="Нет записей"
          description="Когда клиенты запишутся, их заявки появятся здесь"
        />
      ) : (
        <>
          {/* Pending bookings */}
          {pendingBookings.length > 0 && (
            <section className="mb-6">
              <h2 className="text-base font-medium text-foreground mb-3">
                Новые заявки
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full bg-warning/20 text-warning">
                  {pendingBookings.length}
                </span>
              </h2>
              <div className="space-y-3">
                {pendingBookings.map((booking) => (
                  <PendingBookingCard
                    key={booking.id}
                    booking={booking}
                    onAccept={handleAccept}
                    onReject={handleRejectClick}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Upcoming confirmed bookings */}
          {upcomingBookings.length > 0 && (
            <section>
              <h2 className="text-base font-medium text-foreground mb-3">
                Ближайшие записи
              </h2>
              <div className="space-y-3">
                {upcomingBookings.map((booking) => (
                  <UpcomingBookingCard
                    key={booking.id}
                    booking={booking}
                    onClick={handleBookingClick}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Reject Confirmation */}
      <ConfirmDialog
        isOpen={showRejectDialog}
        title="Отклонить заявку?"
        description={`Вы уверены, что хотите отклонить заявку клиента ${rejectTarget?.clientName}?`}
        confirmText="Отклонить"
        cancelText="Назад"
        onConfirm={handleConfirmReject}
        onClose={() => {
          setShowRejectDialog(false);
          setRejectTarget(null);
        }}
        destructive
      />

      {/* Booking Detail Modal */}
      <BookingDetailModal
        booking={selectedBooking}
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onCancel={handleCancelClick}
      />

      {/* Cancel Confirmation */}
      <ConfirmDialog
        isOpen={showCancelDialog}
        title="Отменить запись?"
        description={`Вы уверены, что хотите отменить запись клиента ${selectedBooking?.clientName}?`}
        confirmText="Отменить запись"
        cancelText="Назад"
        onConfirm={handleConfirmCancel}
        onClose={() => setShowCancelDialog(false)}
        destructive
      />
    </div>
  );
}
