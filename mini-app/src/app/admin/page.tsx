"use client";

import { useState } from "react";
import { NearestBookingCard } from "@/components/NearestBookingCard";
import { ScheduleTabs } from "@/components/ScheduleTabs";
import { DayTimeline } from "@/components/DayTimeline";
import { WeekGrid } from "@/components/WeekGrid";
import { WeekDatePicker } from "@/components/WeekDatePicker";
import { BookingDetailModal } from "@/components/BookingDetailModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Booking } from "@/lib/types";

// Mock data for development
const mockBookings: Booking[] = [
  {
    id: "1",
    startsAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    clientName: "Райан Гослинг",
    status: "confirmed",
    sessionType: {
      id: "1",
      type: "personal",
      name: "Тренировка стандарт",
      durationMinutes: 60,
      price: 2500,
      currency: "RUB",
    },
  },
  {
    id: "2",
    startsAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    clientName: "Анна Иванова",
    status: "confirmed",
    sessionType: {
      id: "2",
      type: "personal",
      name: "Персональная тренировка",
      durationMinutes: 60,
      price: 3000,
      currency: "RUB",
    },
  },
  {
    id: "3",
    startsAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    clientName: "Петр Сидоров",
    status: "pending",
    sessionType: {
      id: "1",
      type: "personal",
      name: "Тренировка стандарт",
      durationMinutes: 60,
      price: 2500,
      currency: "RUB",
    },
  },
];

export default function AdminSchedulePage() {
  const [activeTab, setActiveTab] = useState<"day" | "week">("day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [bookings] = useState<Booking[]>(mockBookings);

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

  const handleConfirmCancel = () => {
    // TODO: Implement cancel API call
    console.log("Cancel booking:", selectedBooking?.id);
    setShowCancelDialog(false);
    setSelectedBooking(null);
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setActiveTab("day");
  };

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
      <h2 className="text-base font-medium text-[var(--app-text)] mb-3">
        Расписание
      </h2>

      {/* Tabs */}
      <ScheduleTabs activeTab={activeTab} onChange={setActiveTab} />

      {/* Date Picker (Day view) */}
      {activeTab === "day" && (
        <div className="mb-4">
          <WeekDatePicker
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
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
