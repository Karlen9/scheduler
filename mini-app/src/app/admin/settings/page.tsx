"use client";

import { useEffect, useRef } from "react";
import { Users, User, DollarSign, Clock, Bell, HelpCircle, CalendarOff } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { setLocale } from "@/actions/locale";
import { TopBar } from "@/components/TopBar";
import { SettingsMenuItem, SettingsGroup } from "@/components/SettingsMenuItem";
import { ThemeSelector } from "@/components/ThemeSelector";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useAdminProfile } from "@/hooks/queries";

export default function SettingsPage() {
  const t = useTranslations("AdminSettings");
  const tl = useTranslations("LanguageSelector");
  const locale = useLocale();
  const router = useRouter();
  const { data: trainerProfile } = useAdminProfile();

  // Cross-device language sync
  const syncedRef = useRef(false);
  useEffect(() => {
    if (trainerProfile?.language && trainerProfile.language !== locale && !syncedRef.current) {
      syncedRef.current = true;
      setLocale(trainerProfile.language).then(() => router.refresh());
    }
  }, [trainerProfile?.language, locale, router]);

  return (
    <div>
      <TopBar title={t("title")} />

      <div className="p-4">
        <SettingsGroup title={t("management")}>
          <SettingsMenuItem
            icon={Users}
            label={t("clients")}
            href="/admin/clients"
            iconColor="bg-[#a855f7]"
          />
        </SettingsGroup>

        <SettingsGroup title={t("main")}>
          <SettingsMenuItem
            icon={User}
            label={t("profile")}
            href="/admin/settings/profile"
            iconColor="bg-brand"
          />
          <SettingsMenuItem
            icon={DollarSign}
            label={t("servicesAndPrices")}
            href="/admin/settings/services"
            iconColor="bg-success"
          />
          <SettingsMenuItem
            icon={Clock}
            label={t("schedule")}
            href="/admin/settings/schedule"
            iconColor="bg-warning"
          />
          <SettingsMenuItem
            icon={CalendarOff}
            label={t("daysOff")}
            href="/admin/settings/days-off"
            iconColor="bg-error"
          />
        </SettingsGroup>

        <SettingsGroup title={t("other")}>
          <SettingsMenuItem
            icon={Bell}
            label={t("notifications")}
            href="/admin/settings/notifications"
            iconColor="bg-[#a855f7]"
          />
          <SettingsMenuItem
            icon={HelpCircle}
            label={t("help")}
            href="/admin/settings/help"
            iconColor="bg-[#3b82f6]"
          />
        </SettingsGroup>

        <div className="mt-2">
          <h3 className="text-sm text-muted-foreground mb-3">{t("theme")}</h3>
          <ThemeSelector />
        </div>

        <div className="mt-4">
          <h3 className="text-sm text-muted-foreground mb-3">{tl("language")}</h3>
          <LanguageSelector isAdmin />
        </div>
      </div>
    </div>
  );
}
