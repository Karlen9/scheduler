import type { Metadata, Viewport } from "next";
import { SWRProvider } from "@/hooks/swr";
import { ToastProvider } from "@/components/ToastProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scheduler - Фитнес тренер",
  description: "Запись на тренировки к фитнес-тренеру",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" />
        {/* Detect dark/light theme early to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=window.Telegram&&window.Telegram.WebApp;if(t&&t.colorScheme==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})()` }} />
      </head>
      <body>
        <SWRProvider>
          {children}
        </SWRProvider>
        <ToastProvider />
      </body>
    </html>
  );
}
