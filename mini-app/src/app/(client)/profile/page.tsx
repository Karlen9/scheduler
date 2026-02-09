"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { PrimaryButton } from "@/components/PrimaryButton";
import { DurationSelector } from "@/components/DurationSelector";
import { api } from "@/lib/api";

export default function ClientProfilePage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredDuration, setPreferredDuration] = useState<number>(60);
  const [durations, setDurations] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notifyBookingStatus, setNotifyBookingStatus] = useState(true);
  const [notifyReminders, setNotifyReminders] = useState(true);
  const [notifyDaysOff, setNotifyDaysOff] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profile, availableDurations] = await Promise.all([
          api.getProfile(),
          api.getDurations().catch(() => [60]),
        ]);
        setName(profile.name || "");
        setPhone(profile.phone || "");
        setPreferredDuration(profile.preferredDuration || availableDurations[0] || 60);
        setDurations(availableDurations);
        setNotifyBookingStatus(profile.notifyBookingStatus ?? true);
        setNotifyReminders(profile.notifyReminders ?? true);
        setNotifyDaysOff(profile.notifyDaysOff ?? false);
      } catch (err) {
        console.error("Failed to fetch profile:", err);
        toast.error("Ошибка загрузки профиля");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.updateProfile({ name, phone, preferredDuration });
      toast.success("Профиль сохранен");
    } catch (err) {
      console.error("Failed to save profile:", err);
      toast.error("Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleNotification = async (
    key: "notifyBookingStatus" | "notifyReminders" | "notifyDaysOff",
    value: boolean,
  ) => {
    const setters = {
      notifyBookingStatus: setNotifyBookingStatus,
      notifyReminders: setNotifyReminders,
      notifyDaysOff: setNotifyDaysOff,
    };
    setters[key](value);
    try {
      await api.updateNotificationPrefs({ [key]: value });
    } catch {
      setters[key](!value);
      toast.error("Ошибка сохранения настроек");
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-6 animate-pulse">
        <div className="flex justify-center pt-2">
          <div className="w-24 h-24 rounded-full bg-card" />
        </div>
        <div className="space-y-4">
          <div>
            <div className="h-4 bg-card rounded w-10 mb-2" />
            <div className="h-12 bg-card rounded-lg" />
          </div>
          <div>
            <div className="h-4 bg-card rounded w-16 mb-2" />
            <div className="h-12 bg-card rounded-lg" />
          </div>
        </div>
        <div className="h-12 bg-card rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Avatar */}
      <div className="flex justify-center pt-2">
        <div className="w-24 h-24 rounded-full bg-card flex items-center justify-center text-3xl text-muted-foreground">
          {name.charAt(0) || "?"}
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-muted-foreground mb-1">
            Имя
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            className="w-full px-4 py-3 rounded-lg bg-card text-foreground outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <div>
          <label className="block text-sm text-muted-foreground mb-1">
            Телефон
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={20}
            placeholder="+7 (999) 123-45-67"
            className="w-full px-4 py-3 rounded-lg bg-card text-foreground outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        {durations.length > 1 && (
          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              Предпочитаемая длительность
            </label>
            <DurationSelector
              durations={durations}
              selected={preferredDuration}
              onChange={setPreferredDuration}
            />
          </div>
        )}
      </div>

      {/* Save Button */}
      <PrimaryButton onClick={handleSave} disabled={isSaving}>
        {isSaving ? "Сохранение..." : "Сохранить"}
      </PrimaryButton>

      {/* Notification Preferences */}
      <div>
        <h3 className="text-sm text-muted-foreground mb-3">Уведомления</h3>
        <div className="bg-card rounded-lg divide-y divide-border">
          {[
            { key: "notifyBookingStatus" as const, label: "Статус записи", desc: "Подтверждение и отмена записей", value: notifyBookingStatus },
            { key: "notifyReminders" as const, label: "Напоминания", desc: "За час до тренировки", value: notifyReminders },
            { key: "notifyDaysOff" as const, label: "Выходные тренера", desc: "Новые выходные дни", value: notifyDaysOff },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleNotification(item.key, !item.value)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  item.value ? "bg-brand" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    item.value ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
