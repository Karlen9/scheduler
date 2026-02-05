"use client";

interface ScheduleTabsProps {
  activeTab: "day" | "week";
  onChange: (tab: "day" | "week") => void;
}

export function ScheduleTabs({ activeTab, onChange }: ScheduleTabsProps) {
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
        День
      </button>
      <button
        onClick={() => onChange("week")}
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
          activeTab === "week"
            ? "bg-foreground text-white"
            : "text-muted-foreground hover:bg-card"
        }`}
      >
        Неделя
      </button>
    </div>
  );
}
