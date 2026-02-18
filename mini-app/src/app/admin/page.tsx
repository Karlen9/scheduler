"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Bell, Users } from "lucide-react";
import { BookingDetailModal } from "@/components/BookingDetailModal";
import { BottomSheet } from "@/components/BottomSheet";
import { PendingBookingCard } from "@/components/PendingBookingCard";
import { RescheduleSheet } from "@/components/RescheduleSheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NextBookingBanner } from "@/components/schedule/NextBookingBanner";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { StatCard } from "@/components/StatCard";
import { Booking } from "@/lib/types";
import { api } from "@/lib/api";
import { useAdminBookings, useAdminWorkingHours, useAdminDaysOff, useClients } from "@/hooks/queries";
import { invalidateBookings } from "@/hooks/mutations";

export default function AdminHomePage() {
  const router = useRouter();
  const t = useTranslations("AdminDashboard");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const ts = useTranslations("Success");
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
  const [showPendingSheet, setShowPendingSheet] = useState(false);

  const error = fetchError ? (fetchError instanceof Error ? fetchError.message : t("loadError")) : null;

  const pendingBookings = useMemo(
    () => bookings.filter((b) => b.status === "pending" && b.createdBy !== "trainer")
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [bookings],
  );

  const pendingCount = pendingBookings.length;

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
      toast.success(ts("bookingConfirmed"));
      setSelectedBooking(null);
      await invalidateBookings();
    } catch {
      toast.error(te("bookingConfirmFailed"));
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
      toast.success(ts("bookingRejected"));
      await invalidateBookings();
    } catch {
      toast.error(te("bookingRejectFailed"));
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
      toast.success(ts("bookingCancelled"));
      await invalidateBookings();
    } catch {
      toast.error(te("bookingCancelFailed"));
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
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-action-danger-bg text-action-danger-text p-4 rounded-xl text-center">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="p-4 space-y-6">
        {/* Next upcoming booking */}
        <NextBookingBanner booking={nextBooking} onBookingClick={handleBookingClick} />

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={Bell}
            iconColor="text-warning"
            iconBg="bg-warning/20"
            value={pendingCount}
            label={t("newRequests")}
            onClick={pendingCount > 0 ? () => setShowPendingSheet(true) : undefined}
          />
          <StatCard
            icon={Users}
            iconColor="text-brand"
            iconBg="bg-brand/20"
            value={clients.length}
            label={t("allClients")}
            onClick={() => router.push("/admin/clients")}
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
        title={t("rejectDialog")}
        description={t("rejectDialogDescription", { name: rejectTarget?.clientName || "" })}
        confirmText={t("rejectConfirm")}
        cancelText={tc("back")}
        onConfirm={handleConfirmReject}
        onClose={() => {
          setShowRejectDialog(false);
          setRejectTarget(null);
          setRejectReason("");
        }}
        destructive
        showInput
        inputPlaceholder={t("rejectReasonPlaceholder")}
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
          toast.success(ts("bookingRescheduled"));
          invalidateBookings();
        }}
      />

      {/* Cancel dialog */}
      <ConfirmDialog
        isOpen={showCancelDialog}
        title={t("cancelDialog")}
        description={t("cancelDialogDescription", { name: selectedBooking?.clientName || "" })}
        confirmText={t("cancelConfirm")}
        cancelText={tc("back")}
        onConfirm={handleConfirmCancel}
        onClose={() => {
          setShowCancelDialog(false);
          setCancelReason("");
        }}
        destructive
        showInput
        inputPlaceholder={t("cancelReasonPlaceholder")}
        inputValue={cancelReason}
        onInputChange={setCancelReason}
      />

      {/* Pending requests sheet */}
      <BottomSheet
        isOpen={showPendingSheet}
        onClose={() => setShowPendingSheet(false)}
        title={t("newRequests")}
        className="max-h-[70vh] overflow-y-auto"
      >
        <div className="space-y-3">
          {pendingBookings.map((booking) => (
            <PendingBookingCard
              key={booking.id}
              booking={booking}
              onAccept={async (b) => {
                await handleAccept(b);
                if (pendingBookings.length <= 1) setShowPendingSheet(false);
              }}
              onReject={(b) => {
                setShowPendingSheet(false);
                handleRejectClick(b);
              }}
            />
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
