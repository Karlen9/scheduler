"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Users } from "lucide-react";
import { useTrainer } from "@/hooks/queries";
import { useAdminBookings } from "@/hooks/queries";
import { Booking } from "@/lib/types";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { data: trainer, isLoading: trainerLoading } = useTrainer();
  const { data: bookings, isLoading: bookingsLoading } = useAdminBookings();

  const isLoading = trainerLoading || bookingsLoading;

  const stats = useMemo(() => {
    const now = new Date();
    const pending = bookings.filter((b: Booking) => b.status === "pending").length;
    const upcoming = bookings.filter(
      (b: Booking) =>
        (b.status === "confirmed" || b.status === "cancel_requested" || b.status === "reschedule_pending") &&
        new Date(b.startsAt) > now
    ).length;
    return { pending, upcoming };
  }, [bookings]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-8 bg-card rounded w-48 mb-2" />
        <div className="h-4 bg-card rounded w-32" />
        <div className="grid grid-cols-2 gap-3 mt-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl p-4 h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {trainer?.name || "Тренер"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Панель управления
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => router.push("/admin/bookings")}
          className="bg-card rounded-xl p-4 text-left"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-warning" />
            </div>
          </div>
          <p className="text-2xl font-semibold text-foreground">{stats.pending}</p>
          <p className="text-xs text-muted-foreground">Новых заявок</p>
        </button>

        <button
          onClick={() => router.push("/admin/bookings")}
          className="bg-card rounded-xl p-4 text-left"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-success" />
            </div>
          </div>
          <p className="text-2xl font-semibold text-foreground">{stats.upcoming}</p>
          <p className="text-xs text-muted-foreground">Ближайших записей</p>
        </button>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Быстрые действия</h2>
        <div className="space-y-2">
          <button
            onClick={() => router.push("/admin/clients")}
            className="w-full flex items-center gap-3 px-4 py-3 bg-card rounded-xl text-left"
          >
            <div className="w-10 h-10 rounded-full bg-[#a855f7]/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-[#a855f7]" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Клиенты</p>
              <p className="text-xs text-muted-foreground">Список клиентов</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
