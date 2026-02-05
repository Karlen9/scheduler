"use client";

import { useState, useEffect, useCallback } from "react";
import { NearestBookingCard } from "@/components/NearestBookingCard";
import { ScheduleTabs } from "@/components/ScheduleTabs";
import { DayTimeline } from "@/components/DayTimeline";
import { WeekGrid } from "@/components/WeekGrid";
import { MonthCalendar } from "@/components/MonthCalendar";
import { BookingDetailModal } from "@/components/BookingDetailModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Booking, DayOff } from "@/lib/types";
import { api } from "@/lib/api";

export default function AdminSchedulePage() {
  const [activeTab, setActiveTab] = useState<"day" | "week">("day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [daysOff, setDaysOff] = useState<DayOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [bookingsData, daysOffData] = await Promise.all([
        api.admin.getBookings(),
        api.admin.getDaysOff(),
      ]);
      setBookings(bookingsData);
      setDaysOff(daysOffData);
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Find nearest upcoming booking
  const now = new Date();
  const upcomingBookings = bookings
    .filter((b) => new Date(b.startsAt) > now && (b.status === "confirmed" || b.status === "pending"))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const nearestBooking = upcomingBookings[0];

  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking);
  };

  const handleReschedule = (booking: Booking) => {
    // TODO: Implement reschedule flow
    console.log("Reschedule booking:", booking.id);
    setSelectedBooking(null);
  };

  const handleCancelClick = () => {
    setShowCancelDialog(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedBooking) return;
    try {
      await api.admin.updateBookingStatus(selectedBooking.id, "cancelled");
      await fetchData();
    } catch (err) {
      console.error("Failed to cancel booking:", err);
    }
    setShowCancelDialog(false);
    setSelectedBooking(null);
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setActiveTab("day");
  };

  // Convert daysOff to Date array
  const daysOffDates = daysOff.map((d) => new Date(d.date));

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

  return (
    <div className="p-4">
      {/* Nearest Booking */}
      {nearestBooking && (
        <NearestBookingCard
          booking={nearestBooking}
          onClick={() => handleBookingClick(nearestBooking)}
        />
      )}

      {/* Schedule Header */}
      <h2 className="text-base font-medium text-foreground mb-3">
        Расписание
      </h2>

      {/* Tabs */}
      <ScheduleTabs activeTab={activeTab} onChange={setActiveTab} />

      {/* Calendar (Day view) */}
      {activeTab === "day" && (
        <div className="mb-4">
          <MonthCalendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            bookingDates={bookings.map((b) => new Date(b.startsAt))}
            daysOff={daysOffDates}
          />
        </div>
      )}

      {/* Timeline / Grid */}
      {activeTab === "day" ? (
        <DayTimeline
          date={selectedDate}
          bookings={bookings}
          onBookingClick={handleBookingClick}
        />
      ) : (
        <WeekGrid
          startDate={selectedDate}
          bookings={bookings}
          onDayClick={handleDayClick}
        />
      )}

      {/* Booking Detail Modal */}
      <BookingDetailModal
        booking={selectedBooking}
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onReschedule={handleReschedule}
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
