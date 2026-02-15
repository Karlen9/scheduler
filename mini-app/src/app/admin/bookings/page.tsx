"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, Users } from "lucide-react";
import { ActivityBackButton } from "@/components/ActivityBackButton";
import { BookingDetailModal } from "@/components/BookingDetailModal";
import { RescheduleSheet } from "@/components/RescheduleSheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NextBookingBanner } from "@/components/schedule/NextBookingBanner";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { StatCard } from "@/components/StatCard";
import { Booking } from "@/lib/types";
import { api } from "@/lib/api";
import { useAdminBookings, useAdminWorkingHours, useAdminDaysOff, useClients } from "@/hooks/queries";
import { invalidateBookings } from "@/hooks/mutations";

export default function AdminBookingsPage() {
  const router = useRouter();
  const { data: bookings, isLoading, error: fetchError } = useAdminBookings({ refreshInterval: 15000 });
  const { data: workingHoursData } = useAdminWorkingHours();
  const { data: daysOffData } = useAdminDaysOff();
  const { data: clients } = useClients();

  const nonWorkingDays = useMemo(() => {
    const workingSet = new Set(workingHoursData.map((wh) => wh.dayOfWeek));
    const result: number[] = [];
    for (let i = 0; i < 7; i++) {
      if (!workingSet.has(i)) result.push(i);
    }
    return result;
  }, [workingHoursData]);

  const daysOff = useMemo(() => daysOffData.map((d) => d.date), [daysOffData]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Booking | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);

  const error = fetchError ? (fetchError instanceof Error ? fetchError.message : "Ошибка загрузки") : null;

  const pendingCount = useMemo(
    () => bookings.filter((b) => b.status === "pending" && b.createdBy !== "trainer").length,
    [bookings],
  );

  const scheduleBookings = useMemo(
    () => bookings.filter((b) => b.status === "confirmed" || b.status === "pending"),
    [bookings],
  );

  const nextBooking = useMemo(() => {
    const now = Date.now();
    return (
      bookings
        .filter((b) => b.status === "confirmed" && new Date(b.startsAt).getTime() > now)
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0] || null
    );
  }, [bookings]);

  const handleAccept = async (booking: Booking) => {
    try {
      await api.admin.updateBookingStatus(booking.id, "confirmed");
      toast.success("Запись подтверждена");
      setSelectedBooking(null);
      await invalidateBookings();
    } catch {
      toast.error("Не удалось подтвердить запись");
    }
  };

  const handleRejectClick = (booking: Booking) => {
    setSelectedBooking(null);
    setRejectTarget(booking);
    setShowRejectDialog(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectTarget) return;
    try {
      await api.admin.updateBookingStatus(rejectTarget.id, "rejected", rejectReason || undefined);
      toast.success("Запись отклонена");
      await invalidateBookings();
    } catch {
      toast.error("Не удалось отклонить запись");
    }
    setShowRejectDialog(false);
    setRejectTarget(null);
    setRejectReason("");
  };

  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking);
  };

  const handleRescheduleClick = (booking: Booking) => {
    setSelectedBooking(null);
    setRescheduleBooking(booking);
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
    } catch {
      toast.error("Не удалось отменить запись");
    }
    setShowCancelDialog(false);
    setSelectedBooking(null);
    setCancelReason("");
  };

  const handleEmptySlotClick = (_date: Date, _time: string) => {
    router.push("/admin/book");
  };

  if (isLoading) {
    return (
      <div>
        <ActivityBackButton href="/admin" />
        <div className="p-4 space-y-6">
          <div className="animate-pulse">
            <div className="h-5 w-36 bg-card rounded mb-3" />
            <div className="h-24 bg-card rounded-xl" />
          </div>
          <div className="animate-pulse">
            <div className="h-5 w-28 bg-card rounded mb-3" />
            <div className="h-10 bg-card rounded-xl mb-4" />
            <div className="h-5 w-48 bg-card rounded mb-3" />
            <div className="space-y-2">
              <div className="h-16 bg-card rounded-xl" />
              <div className="h-16 bg-card rounded-xl" />
            </div>
          </div>
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

  return (
    <div>
      <ActivityBackButton href="/admin" />
      <div className="p-4 space-y-6">
        {/* Next upcoming booking */}
        <NextBookingBanner booking={nextBooking} />

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={Bell}
            iconColor="text-warning"
            iconBg="bg-warning/20"
            value={pendingCount}
            label="Новые заявки"
          />
          <StatCard
            icon={Users}
            iconColor="text-brand"
            iconBg="bg-brand/20"
            value={clients.length}
            label="Все клиенты"
          />
        </div>

        {/* Schedule */}
        <ScheduleView
          bookings={scheduleBookings}
          onBookingClick={handleBookingClick}
          nonWorkingDays={nonWorkingDays}
          daysOff={daysOff}
          workingHours={workingHoursData}
          onEmptySlotClick={handleEmptySlotClick}
        />
      </div>

      {/* Reject dialog */}
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

      {/* Booking detail modal */}
      <BookingDetailModal
        booking={selectedBooking}
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onReschedule={handleRescheduleClick}
        onCancel={handleCancelClick}
        onAccept={handleAccept}
        onReject={handleRejectClick}
      />

      {/* Reschedule sheet */}
      <RescheduleSheet
        booking={rescheduleBooking}
        isOpen={!!rescheduleBooking}
        onClose={() => setRescheduleBooking(null)}
        onSuccess={() => {
          toast.success("Запись перенесена");
          invalidateBookings();
        }}
      />

      {/* Cancel dialog */}
      <ConfirmDialog
        isOpen={showCancelDialog}
        title="Отменить запись?"
        description={`Вы уверены, что хотите отменить запись клиента ${selectedBooking?.clientName}?`}
        confirmText="Отменить запись"
        cancelText="Назад"
        onConfirm={handleConfirmCancel}
        onClose={() => {
          setShowCancelDialog(false);
          setCancelReason("");
        }}
        destructive
        showInput
        inputPlaceholder="Причина отмены (необязательно)"
        inputValue={cancelReason}
        onInputChange={setCancelReason}
      />
    </div>
  );
}
