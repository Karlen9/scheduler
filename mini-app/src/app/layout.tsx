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
    <html lang="ru" className="dark">
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" />
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
