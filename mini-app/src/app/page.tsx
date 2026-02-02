"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { initTelegramApp, getUserName, getThemeParams } from "@/lib/telegram";
import { api } from "@/lib/api";
import { Trainer } from "@/lib/types";
import { Loading } from "@/components/Loading";

export default function Home() {
  const router = useRouter();
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initTelegramApp();

    const params = getThemeParams();
    const root = document.documentElement;
    if (params.bg_color) root.style.setProperty("--tg-theme-bg-color", params.bg_color);
    if (params.text_color) root.style.setProperty("--tg-theme-text-color", params.text_color);
    if (params.hint_color) root.style.setProperty("--tg-theme-hint-color", params.hint_color);
    if (params.link_color) root.style.setProperty("--tg-theme-link-color", params.link_color);
    if (params.button_color) root.style.setProperty("--tg-theme-button-color", params.button_color);
    if (params.button_text_color) root.style.setProperty("--tg-theme-button-text-color", params.button_text_color);
    if (params.secondary_bg_color) root.style.setProperty("--tg-theme-secondary-bg-color", params.secondary_bg_color);

    api.getTrainer().then((t) => {
      setTrainer(t);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#E8EEF4]">
        <Loading />
      </div>
    );
  }

  const userName = getUserName();

  return (
    <div className="min-h-screen bg-[#E8EEF4] flex flex-col">
      {/* Header with trainer photo */}
      <div className="relative flex-shrink-0">
        {/* Trainer info and photo area */}
        <div className="pt-10 pb-8 px-6 flex items-end justify-between min-h-[280px]">
          <div className="flex-1 pb-4">
            <p className="text-gray-500 text-sm mb-1">Добро пожаловать, {userName}</p>
            <p className="text-gray-500 text-sm mb-2">Фитнес-тренер</p>
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">
              {trainer?.name?.split(' ').map((word, i) => (
                <span key={i}>
                  {word}
                  {i === 0 && <br />}
                </span>
              ))}
            </h1>
          </div>
          {/* Trainer photo placeholder */}
          <div className="w-40 h-48 relative -mr-2">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-200 to-orange-300 rounded-2xl flex items-end justify-center overflow-hidden">
              <svg width="120" height="140" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="0.8" className="opacity-40">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* White card */}
      <div className="flex-1 bg-white rounded-t-[32px] px-6 pt-8 pb-10 -mt-4 relative z-10">
        {/* Quick Actions */}
        <div className="flex flex-col gap-4">
          <button
            onClick={() => router.push("/book")}
            className="w-full py-4 rounded-full bg-[#4A90D9] text-white font-semibold text-base active:scale-[0.98] transition-all"
          >
            Записаться на тренировку
          </button>

          <button
            onClick={() => router.push("/bookings")}
            className="w-full py-4 rounded-full border border-gray-200 text-gray-700 font-semibold text-base active:scale-[0.98] transition-all"
          >
            Мои записи
          </button>
        </div>

        {/* Info */}
        <div className="mt-8 p-5 rounded-2xl bg-[#F5F7FA]">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-[#E8EEF4] flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A90D9" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Правила отмены</p>
              <p className="text-sm text-gray-500 mt-1">
                Отмена и перенос записи возможны не позднее чем за {trainer?.cancelCutoffHours} часов до начала тренировки
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
