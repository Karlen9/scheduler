"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { setLocale } from "@/actions/locale";
import { TopBar } from "@/components/TopBar";
import { ThemeSelector } from "@/components/ThemeSelector";
import { LanguageSelector } from "@/components/LanguageSelector";
import { api } from "@/lib/api";
import { useAdminNotifications, useAdminProfile } from "@/hooks/queries";
import { invalidateAdminNotifications } from "@/hooks/mutations";

export default function AdminNotificationsPage() {
  const t = useTranslations("AdminNotifications");
  const te = useTranslations("Errors");
  const tl = useTranslations("LanguageSelector");
  const locale = useLocale();
  const router = useRouter();
  const { data: prefs, isLoading } = useAdminNotifications();
  const { data: trainerProfile } = useAdminProfile();
  const [notifyNewBookings, setNotifyNewBookings] = useState(true);
  const [notifyCancellations, setNotifyCancellations] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (isLoading || initialized || !prefs) return;

    setNotifyNewBookings(prefs.notifyNewBookings);
    setNotifyCancellations(prefs.notifyCancellations);
    setInitialized(true);
  }, [prefs, isLoading, initialized]);

  // Cross-device language sync
  const syncedRef = useRef(false);
  useEffect(() => {
    if (trainerProfile?.language && trainerProfile.language !== locale && !syncedRef.current) {
      syncedRef.current = true;
      setLocale(trainerProfile.language).then(() => router.refresh());
    }
  }, [trainerProfile?.language, locale, router]);

  const handleToggle = async (
    key: "notifyNewBookings" | "notifyCancellations",
    value: boolean,
  ) => {
    const setters = {
      notifyNewBookings: setNotifyNewBookings,
      notifyCancellations: setNotifyCancellations,
    };
    setters[key](value);
    try {
      await api.admin.updateNotificationPrefs({ [key]: value });
      invalidateAdminNotifications();
    } catch {
      setters[key](!value);
      toast.error(te("saveSettingsFailed"));
    }
  };

  if (isLoading) {
    return (
      <div>
        <TopBar title={t("title")} showBack />
        <div className="p-4 space-y-3 animate-pulse">
          <div className="h-14 bg-card rounded-lg" />
          <div className="h-14 bg-card rounded-lg" />
        </div>
      </div>
    );
  }

  const items = [
    { key: "notifyNewBookings" as const, label: t("newBookings"), desc: t("newBookingsDesc"), value: notifyNewBookings },
    { key: "notifyCancellations" as const, label: t("clientCancellations"), desc: t("clientCancellationsDesc"), value: notifyCancellations },
  ];

  return (
    <div>
      <TopBar title={t("title")} showBack />

      <div className="p-4">
        <div className="bg-card rounded-lg divide-y divide-border">
          {items.map((item) => (
            <div key={item.key} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle(item.key, !item.value)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  item.value ? "bg-brand" : "bg-switch-background"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    item.value ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
      {/* Theme */}
      <div className="p-4 pt-0">
        <h3 className="text-sm text-muted-foreground mb-3">{t("theme")}</h3>
        <ThemeSelector />
      </div>
      {/* Language */}
      <div className="p-4 pt-0">
        <h3 className="text-sm text-muted-foreground mb-3">{tl("language")}</h3>
        <LanguageSelector isAdmin />
      </div>
    </div>
  );
}
