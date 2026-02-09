"use client";

import { useState, useEffect } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
      } catch (err) {
        console.error("Failed to fetch profile:", err);
        setError("Ошибка загрузки профиля");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.updateProfile({ name, phone, preferredDuration });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to save profile:", err);
      setError("Ошибка сохранения");
    } finally {
      setIsSaving(false);
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

      {/* Status Messages */}
      {error && (
        <div className="bg-red-900/20 text-red-400 p-3 rounded-lg text-sm text-center">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-900/20 text-green-400 p-3 rounded-lg text-sm text-center">
          Профиль сохранен
        </div>
      )}

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
    </div>
  );
}
