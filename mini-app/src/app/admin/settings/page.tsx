"use client";

import { User, DollarSign, Clock, Bell, HelpCircle, CalendarOff } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { SettingsMenuItem, SettingsGroup } from "@/components/SettingsMenuItem";

export default function SettingsPage() {
  return (
    <div>
      <TopBar title="Настройки" />

      <div className="p-4">
        <SettingsGroup title="Основные">
          <SettingsMenuItem
            icon={User}
            label="Профиль"
            href="/admin/settings/profile"
            iconColor="bg-brand"
          />
          <SettingsMenuItem
            icon={DollarSign}
            label="Услуги и цены"
            href="/admin/settings/services"
            iconColor="bg-success"
          />
          <SettingsMenuItem
            icon={Clock}
            label="Расписание"
            href="/admin/settings/schedule"
            iconColor="bg-warning"
          />
          <SettingsMenuItem
            icon={CalendarOff}
            label="Выходные дни"
            href="/admin/settings/days-off"
            iconColor="bg-error"
          />
        </SettingsGroup>

        <SettingsGroup title="Прочее">
          <SettingsMenuItem
            icon={Bell}
            label="Уведомления"
            href="/admin/settings/notifications"
            iconColor="bg-[#a855f7]"
          />
          <SettingsMenuItem
            icon={HelpCircle}
            label="Помощь"
            href="/admin/settings/help"
            iconColor="bg-[#3b82f6]"
          />
        </SettingsGroup>
      </div>
    </div>
  );
}
