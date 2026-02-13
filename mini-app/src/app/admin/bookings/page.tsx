"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, ChevronDown, UserPlus, Repeat } from "lucide-react";
import { toast } from "sonner";
import { ActivityBackButton } from "@/components/ActivityBackButton";
import { PendingBookingCard } from "@/components/PendingBookingCard";
import { UpcomingBookingCard } from "@/components/UpcomingBookingCard";
import { BookingDetailModal } from "@/components/BookingDetailModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { Booking } from "@/lib/types";
import { api } from "@/lib/api";

export default function AdminBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Booking | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showPast, setShowPast] = useState(false);

  const initialLoadDone = React.useRef(false);
  const fetchData = useCallback(async () => {
    try {
      if (!initialLoadDone.current) {
        setLoading(true);
      }
      setError(null);
      const data = await api.admin.getBookings();
      setBookings(data);
      initialLoadDone.current = true;
    } catch (err) {
      console.error("Failed to fetch bookings:", err);
      if (!initialLoadDone.current) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Poll every 15 seconds to detect status changes from bot chat
    const interval = setInterval(() => {
      fetchData();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

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
      await api.admin.updateBookingStatus(rejectTarget.id, "rejected", rejectReason || undefined);
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
      await api.admin.updateBookingStatus(selectedBooking.id, "cancelled", cancelReason || undefined);
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
      <div className="p-4 space-y-6 animate-pulse">
        <section>
          <div className="h-5 bg-card rounded w-28 mb-3" />
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl p-4 border-l-4 border-l-border">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-border shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-border rounded w-1/3" />
                    <div className="h-3 bg-border rounded w-1/4" />
                    <div className="h-3 bg-border rounded w-1/2" />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <div className="flex-1 h-9 bg-border rounded-lg" />
                  <div className="flex-1 h-9 bg-border rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section>
          <div className="h-5 bg-card rounded w-36 mb-3" />
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl p-4 border-l-4 border-l-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-border shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-border rounded w-1/3" />
                    <div className="h-3 bg-border rounded w-1/4" />
                  </div>
                  <div className="space-y-1.5 shrink-0">
                    <div className="h-4 bg-border rounded w-20" />
                    <div className="h-3 bg-border rounded w-16 ml-auto" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
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
