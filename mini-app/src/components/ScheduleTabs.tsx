"use client";

import { useTranslations } from "next-intl";

interface ScheduleTabsProps {
  activeTab: "day" | "week";
  onChange: (tab: "day" | "week") => void;
}

export function ScheduleTabs({ activeTab, onChange }: ScheduleTabsProps) {
  const t = useTranslations("ScheduleView");

  return (
    <div className="flex gap-2 mb-4">
      <button
        onClick={() => onChange("day")}
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
          activeTab === "day"
            ? "bg-foreground text-white"
            : "text-muted-foreground hover:bg-card"
        }`}
      >
        {t("day")}
      </button>
      <button
        onClick={() => onChange("week")}
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
          activeTab === "week"
            ? "bg-foreground text-white"
            : "text-muted-foreground hover:bg-card"
        }`}
      >
        {t("week")}
      </button>
    </div>
  );
}
