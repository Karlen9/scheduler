"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, ChevronDown, UserPlus, Repeat } from "lucide-react";
import { toast } from "sonner";
import { ActivityBackButton } from "@/components/ActivityBackButton";
import { PendingBookingCard } from "@/components/PendingBookingCard";
import { UpcomingBookingCard } from "@/components/UpcomingBookingCard";
import { PendingBookingCardSkeleton, UpcomingBookingCardSkeleton } from "@/components/LoadingSkeleton";
import { BookingDetailModal } from "@/components/BookingDetailModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { Booking } from "@/lib/types";
import { api } from "@/lib/api";
import { useAdminBookings } from "@/hooks/queries";
import { invalidateBookings } from "@/hooks/mutations";

export default function AdminBookingsPage() {
  const router = useRouter();
  const { data: bookings, isLoading: loading, error: fetchError } = useAdminBookings({ refreshInterval: 15000 });
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Booking | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showPast, setShowPast] = useState(false);

  const error = fetchError ? (fetchError instanceof Error ? fetchError.message : "Ошибка загрузки") : null;

  const now = new Date();

  const pendingBookings = bookings
    .filter((b) => b.status === "pending")
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const upcomingBookings = bookings
    .filter((b) => (b.status === "confirmed" || b.status === "cancel_requested" || b.status === "reschedule_pending") && new Date(b.startsAt) > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const pastBookings = bookings
    .filter((b) => b.status === "completed" || b.status === "cancelled" || b.status === "rejected" || (b.status === "confirmed" && new Date(b.startsAt) <= now))
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  const handleAccept = async (booking: Booking) => {
    try {
      await api.admin.updateBookingStatus(booking.id, "confirmed");
      toast.success("Запись подтверждена");
      await invalidateBookings();
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
      await api.admin.updateBookingStatus(rejectTarget.id, "rejected", rejectReason || undefined);
      toast.success("Запись отклонена");
      await invalidateBookings();
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
      await api.admin.updateBookingStatus(selectedBooking.id, "cancelled", cancelReason || undefined);
      toast.success("Запись отменена");
      await invalidateBookings();
    } catch (err) {
      console.error("Failed to cancel booking:", err);
      toast.error("Не удалось отменить запись");
    }
    setShowCancelDialog(false);
    setSelectedBooking(null);
  };

  if (loading) {
    return (
      <div>
        <ActivityBackButton href="/admin" />
        <div className="p-4 space-y-6">
          <section>
            <div className="h-5 bg-card rounded w-28 mb-3 animate-pulse" />
            <div className="space-y-3">
              <PendingBookingCardSkeleton />
              <PendingBookingCardSkeleton />
            </div>
          </section>
          <section>
            <div className="h-5 bg-card rounded w-36 mb-3 animate-pulse" />
            <div className="space-y-3">
              <UpcomingBookingCardSkeleton />
              <UpcomingBookingCardSkeleton />
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <ActivityBackButton href="/admin" />
        <div className="p-4">
          <div className="bg-red-900/20 text-red-400 p-4 rounded-xl text-center">
            {error}
          </div>
        </div>
      </div>
    );
  }

  const isEmpty = pendingBookings.length === 0 && upcomingBookings.length === 0 && pastBookings.length === 0;

  return (
    <div>
      <ActivityBackButton href="/admin" />
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
            <section className="mb-6">
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

          {/* Past bookings */}
          {pastBookings.length > 0 && (
            <section>
              <button
                onClick={() => setShowPast(!showPast)}
                className="flex items-center gap-2 text-base font-medium text-muted-foreground mb-3"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showPast ? "rotate-0" : "-rotate-90"}`} />
                Прошедшие ({pastBookings.length})
              </button>
              {showPast && (
                <div className="space-y-3">
                  {pastBookings.map((booking) => (
                    <UpcomingBookingCard
                      key={booking.id}
                      booking={booking}
                      onClick={handleBookingClick}
                    />
                  ))}
                </div>
              )}
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
          setRejectReason("");
        }}
        destructive
        showInput
        inputPlaceholder="Причина отклонения (необязательно)"
        inputValue={rejectReason}
        onInputChange={setRejectReason}
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
        onClose={() => { setShowCancelDialog(false); setCancelReason(""); }}
        destructive
        showInput
        inputPlaceholder="Причина отмены (необязательно)"
        inputValue={cancelReason}
        onInputChange={setCancelReason}
      />
      </div>
    </div>
  );
}
