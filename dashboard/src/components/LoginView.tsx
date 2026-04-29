"use client";

import { useEffect, useRef, useState } from "react";

import {
  DashboardI18nProvider,
  LanguageSwitch,
  useDashboardI18n,
} from "@/lib/i18n";
import type { ReactNode } from "react";

type TelegramLoginUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

declare global {
  interface Window {
    onTelegramDashboardAuth?: (user: TelegramLoginUser) => void;
  }
}

function normalizeBotUsername(value?: string): string {
  return value?.trim().replace(/^@/, "") ?? "";
}

function isValidBotUsername(value: string): boolean {
  return (
    /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(value) &&
    value.toLowerCase().endsWith("bot")
  );
}

function getTelegramOriginError(
  location: Location,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (localHosts.has(location.hostname)) {
    return t(
      "Telegram Login does not work from localhost. Open the dashboard through a public HTTPS domain or tunnel, then set that domain for this bot in BotFather.",
    );
  }
  if (location.protocol !== "https:") {
    return t(
      "Telegram Login requires HTTPS. Current origin is {{origin}}. Open the dashboard through HTTPS and set that domain for this bot in BotFather.",
      { origin: location.origin },
    );
  }
  return "";
}

export function LoginView(): ReactNode {
  return (
    <DashboardI18nProvider>
      <LoginViewInner />
    </DashboardI18nProvider>
  );
}

function LoginViewInner(): ReactNode {
  const { t } = useDashboardI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState("");
  const [widgetError, setWidgetError] = useState("");
  const [isWidgetLoading, setIsWidgetLoading] = useState(false);
  const configuredBotUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  const botUsername = normalizeBotUsername(configuredBotUsername);
  const hasBotUsername = Boolean(botUsername);
  const hasValidBotUsername = Boolean(
    botUsername &&
    isValidBotUsername(botUsername) &&
    !["your_master_bot_username", "your-bot-username"].includes(botUsername),
  );

  useEffect(() => {
    if (!hasValidBotUsername || !botUsername || !containerRef.current) {
      return;
    }

    const originError = getTelegramOriginError(window.location, t);
    if (originError) {
      setWidgetError(originError);
      setIsWidgetLoading(false);
      return;
    }

    setWidgetError("");
    setIsWidgetLoading(true);
    window.onTelegramDashboardAuth = async (
      user: TelegramLoginUser,
    ): Promise<void> => {
      setError("");
      const response = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      });
      if (!response.ok) {
        setError(
          response.status === 403
            ? t("This Telegram account is not allowed.")
            : t("Telegram login failed."),
        );
        return;
      }
      window.location.reload();
    };

    containerRef.current.innerHTML = "";
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-userpic", "true");
    script.setAttribute("data-onauth", "onTelegramDashboardAuth(user)");
    script.onerror = () => {
      setIsWidgetLoading(false);
      setWidgetError(t("Telegram login widget could not be loaded."));
    };
    containerRef.current.appendChild(script);

    const observer = new MutationObserver(() => {
      if (containerRef.current?.querySelector("iframe")) {
        setIsWidgetLoading(false);
        setWidgetError("");
      }
    });
    observer.observe(containerRef.current, { childList: true, subtree: true });

    const timeoutID = window.setTimeout(() => {
      if (!containerRef.current?.querySelector("iframe")) {
        setIsWidgetLoading(false);
        setWidgetError(
          t(
            "Telegram login widget did not render. Check NEXT_PUBLIC_TELEGRAM_BOT_USERNAME and BotFather /setdomain.",
          ),
        );
      }
    }, 3500);

    return () => {
      window.clearTimeout(timeoutID);
      observer.disconnect();
      delete window.onTelegramDashboardAuth;
    };
  }, [botUsername, hasValidBotUsername, t]);

  return (
    <main className={"login-shell"}>
      <section className={"login-panel"}>
        <div className={"login-language"}>
          <LanguageSwitch />
        </div>
        <div>
          <p className={"eyebrow"}>{t("Owner console")}</p>
          <h1>{t("Scheduler dashboard")}</h1>
          <p className={"login-copy"}>
            {t(
              "Sign in with the Telegram account listed in ADMIN_IDS to view platform analytics and manage specialists.",
            )}
          </p>
        </div>
        {hasValidBotUsername ? (
          <div className={"telegram-login-block"}>
            <div className={"telegram-login"} ref={containerRef} />
            {isWidgetLoading ? (
              <div className={"notice-box"}>
                {t("Loading Telegram login...")}
              </div>
            ) : null}
            {widgetError ? (
              <div className={"error-box"}>{widgetError}</div>
            ) : null}
          </div>
        ) : (
          <div className={"error-box"}>
            {hasBotUsername
              ? t(
                  "NEXT_PUBLIC_TELEGRAM_BOT_USERNAME must be the bot username from BotFather, for example scheduler_admin_bot. Do not use a bot token, Telegram account username, @ prefix, or t.me link.",
                )
              : t("NEXT_PUBLIC_TELEGRAM_BOT_USERNAME is not configured.")}
          </div>
        )}
        {error ? <div className={"error-box"}>{error}</div> : null}
      </section>
    </main>
  );
}
