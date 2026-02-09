"use client";

import { useState, useEffect } from "react";
import { TopBar } from "@/components/TopBar";
import { PrimaryButton } from "@/components/PrimaryButton";
import { formatDuration } from "@/components/DurationSelector";
import { api } from "@/lib/api";

const ALL_DURATIONS = [60, 90, 120, 150];

export default function DurationsSettingsPage() {
  const [selected, setSelected] = useState<number[]>([60]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const durations = await api.admin.getDurations();
        setSelected(durations.length > 0 ? durations : [60]);
      } catch (err) {
        console.error("Failed to load durations:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const toggleDuration = (d: number) => {
    setSelected((prev) => {
      if (prev.includes(d)) {
        if (prev.length <= 1) return prev; // at least one must be selected
        return prev.filter((v) => v !== d);
      }
      return [...prev, d].sort((a, b) => a - b);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.admin.updateDurations(selected);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to save durations:", err);
      setError("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <TopBar title="Длительность" showBack />

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {ALL_DURATIONS.map((d) => (
              <div key={d} className="h-14 bg-card rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Выберите доступные длительности тренировок для клиентов
            </p>

            <div className="space-y-2">
              {ALL_DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => toggleDuration(d)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl transition-colors ${
                    selected.includes(d)
                      ? "bg-primary/10 border border-primary"
                      : "bg-card border border-transparent"
                  }`}
                >
                  <span className="text-foreground font-medium">
                    {formatDuration(d)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {d} мин
                  </span>
                </button>
              ))}
            </div>

            {error && (
              <div className="bg-red-900/20 text-red-400 p-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-900/20 text-green-400 p-3 rounded-lg text-sm text-center">
                Сохранено
              </div>
            )}

            <PrimaryButton onClick={handleSave} disabled={saving}>
              {saving ? "Сохранение..." : "Сохранить"}
            </PrimaryButton>
          </>
        )}
      </div>
    </div>
  );
}
