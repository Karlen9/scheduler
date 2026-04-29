"use client";

import { useEffect, useRef, useState } from "react";

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

export function LoginView(): ReactNode {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState("");
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

  useEffect(() => {
    if (!botUsername || !containerRef.current) {
      return;
    }

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
            ? "This Telegram account is not allowed."
            : "Telegram login failed.",
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
    containerRef.current.appendChild(script);

    return () => {
      delete window.onTelegramDashboardAuth;
    };
  }, [botUsername]);

  return (
    <main className={"login-shell"}>
      <section className={"login-panel"}>
        <div>
          <p className={"eyebrow"}>{"Owner console"}</p>
          <h1>{"Scheduler dashboard"}</h1>
          <p className={"login-copy"}>
            {
              "Sign in with the Telegram account listed in ADMIN_IDS to view platform analytics and manage specialists."
            }
          </p>
        </div>
        {botUsername ? (
          <div className={"telegram-login"} ref={containerRef} />
        ) : (
          <div className={"error-box"}>
            {"NEXT_PUBLIC_TELEGRAM_BOT_USERNAME is not configured."}
          </div>
        )}
        {error ? <div className={"error-box"}>{error}</div> : null}
      </section>
    </main>
  );
}
