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
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var p=localStorage.getItem('theme-preference'),r=document.documentElement,s=r.style;if(p==='dark'){r.classList.add('dark');s.setProperty('--tg-theme-bg-color','#1e1e1e');s.setProperty('--tg-theme-text-color','#ffffff');s.setProperty('--tg-theme-hint-color','#999999');s.setProperty('--tg-theme-secondary-bg-color','#2a2a2a')}else if(p==='light'){r.classList.remove('dark');s.setProperty('--tg-theme-bg-color','#ffffff');s.setProperty('--tg-theme-text-color','#000000');s.setProperty('--tg-theme-secondary-bg-color','#efeff4')}else{var t=window.Telegram&&window.Telegram.WebApp;if(t&&t.colorScheme==='dark'){r.classList.add('dark')}}}catch(e){}})()` }} />
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
