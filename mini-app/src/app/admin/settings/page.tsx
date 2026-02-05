"use client";

import { User, DollarSign, Clock, Bell, HelpCircle, CalendarOff } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { SettingsMenuItem } from "@/components/SettingsMenuItem";

export default function SettingsPage() {
  return (
    <div>
      <TopBar title="Настройки" />

      <div className="bg-card">
        <SettingsMenuItem
          icon={User}
          label="Профиль"
          href="/admin/settings/profile"
        />
        <SettingsMenuItem
          icon={DollarSign}
          label="Услуги и цены"
          href="/admin/settings/services"
        />
        <SettingsMenuItem
          icon={Clock}
          label="Расписание"
          href="/admin/settings/schedule"
        />
        <SettingsMenuItem
          icon={CalendarOff}
          label="Выходные дни"
          href="/admin/settings/days-off"
        />
        <SettingsMenuItem
          icon={Bell}
          label="Уведомления"
          href="/admin/settings/notifications"
        />
        <SettingsMenuItem
          icon={HelpCircle}
          label="Помощь"
          href="/admin/settings/help"
        />
      </div>
    </div>
  );
}
