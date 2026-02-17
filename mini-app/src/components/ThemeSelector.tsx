"use client";

import { useState } from "react";
import { Sun, Moon } from "lucide-react";
import { type ThemePreference, getThemePreference, setThemePreference, applyTheme } from "@/lib/telegram";

const options: { value: ThemePreference; label: string; icon?: typeof Sun }[] = [
  { value: "auto", label: "Авто" },
  { value: "light", label: "Светлая", icon: Sun },
  { value: "dark", label: "Тёмная", icon: Moon },
];

export function ThemeSelector() {
  const [current, setCurrent] = useState<ThemePreference>(getThemePreference);

  const handleSelect = (pref: ThemePreference) => {
    setCurrent(pref);
    setThemePreference(pref);
    applyTheme();
  };

  return (
    <div className="flex gap-1 bg-card rounded-lg p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => handleSelect(opt.value)}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            current === opt.value
              ? "bg-brand text-white"
              : "text-muted-foreground"
          }`}
        >
          {opt.icon && <opt.icon className="w-4 h-4" />}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
