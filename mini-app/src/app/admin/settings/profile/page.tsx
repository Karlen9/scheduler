"use client";

import { useState, useEffect } from "react";
import { Camera } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { PrimaryButton } from "@/components/PrimaryButton";
import { api } from "@/lib/api";

export default function ProfilePage() {
  const [name, setName] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [telegram, setTelegram] = useState("");
  const [gymCoords, setGymCoords] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profile = await api.admin.getProfile();
        setName(profile.name || "");
        setSpecialization(profile.specialization || "");
        setBio(profile.bio || "");
        setPhone(profile.phone || "");
        setTelegram(profile.telegramHandle || "");
        if (profile.gymLatitude && profile.gymLongitude) {
          setGymCoords(`${profile.gymLatitude}, ${profile.gymLongitude}`);
        }
      } catch (err) {
        console.error("Failed to fetch profile:", err);
        setError("Ошибка загрузки профиля");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);
    try {
      let gymLatitude = 0;
      let gymLongitude = 0;
      if (gymCoords.trim()) {
        const parts = gymCoords.split(",").map((s) => parseFloat(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          gymLatitude = parts[0];
          gymLongitude = parts[1];
        }
      }
      await api.admin.updateProfile({
        name,
        specialization,
        bio,
        phone,
        telegramHandle: telegram,
        gymLatitude,
        gymLongitude,
      });
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
      <div>
        <TopBar title="Профиль" showBack />
        <div className="p-4 flex justify-center items-center min-h-[200px]">
          <div className="text-muted-foreground">Загрузка...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Профиль" showBack />

      <div className="p-4 space-y-6">
        {/* Avatar */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-card flex items-center justify-center text-3xl text-muted-foreground">
              {name.charAt(0) || "?"}
            </div>
            <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand flex items-center justify-center shadow-lg">
              <Camera className="w-4 h-4 text-white" />
            </button>
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
              Специализация
            </label>
            <input
              type="text"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-card text-foreground outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              О себе
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              placeholder="Расскажите о своем опыте и подходе к тренировкам..."
              className="w-full px-4 py-3 rounded-lg bg-card text-foreground outline-none focus:ring-2 focus:ring-brand resize-none"
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
              className="w-full px-4 py-3 rounded-lg bg-card text-foreground outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              Telegram
            </label>
            <input
              type="text"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              placeholder="@username"
              className="w-full px-4 py-3 rounded-lg bg-card text-foreground outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Location */}
          <div className="pt-2">
            <label className="block text-sm text-muted-foreground mb-1">
              Координаты зала
            </label>
            <input
              type="text"
              value={gymCoords}
              onChange={(e) => setGymCoords(e.target.value)}
              placeholder="47.230380, 38.868990"
              className="w-full px-4 py-3 rounded-lg bg-card text-foreground outline-none focus:ring-2 focus:ring-brand"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Откройте Яндекс Карты, нажмите на точку на карте и скопируйте координаты
            </p>
          </div>
        </div>

        {/* Save Button */}
        <PrimaryButton onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Сохранение..." : "Сохранить"}
        </PrimaryButton>
      </div>
    </div>
  );
}
