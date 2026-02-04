"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { PrimaryButton } from "@/components/PrimaryButton";

export default function ProfilePage() {
  const [name, setName] = useState("Карлен Мисакян");
  const [specialization, setSpecialization] = useState("Фитнес-тренер");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("+7(987)654-32-10");
  const [telegram, setTelegram] = useState("@karlenptsd");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // TODO: Implement save API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  return (
    <div>
      <TopBar title="Профиль" showBack />

      <div className="p-4 space-y-6">
        {/* Avatar */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-[var(--app-surface)] flex items-center justify-center text-3xl text-[var(--app-subtext)]">
              {name.charAt(0)}
            </div>
            <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#5984d8] flex items-center justify-center shadow-lg">
              <Camera className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[var(--app-subtext)] mb-1">
              Имя
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[var(--app-surface)] text-[var(--app-text)] outline-none focus:ring-2 focus:ring-[#5984d8]"
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--app-subtext)] mb-1">
              Специализация
            </label>
            <input
              type="text"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[var(--app-surface)] text-[var(--app-text)] outline-none focus:ring-2 focus:ring-[#5984d8]"
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--app-subtext)] mb-1">
              О себе
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              placeholder="Расскажите о своем опыте и подходе к тренировкам..."
              className="w-full px-4 py-3 rounded-lg bg-[var(--app-surface)] text-[var(--app-text)] outline-none focus:ring-2 focus:ring-[#5984d8] resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--app-subtext)] mb-1">
              Телефон
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[var(--app-surface)] text-[var(--app-text)] outline-none focus:ring-2 focus:ring-[#5984d8]"
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--app-subtext)] mb-1">
              Telegram
            </label>
            <input
              type="text"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              placeholder="@username"
              className="w-full px-4 py-3 rounded-lg bg-[var(--app-surface)] text-[var(--app-text)] outline-none focus:ring-2 focus:ring-[#5984d8]"
            />
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
