import Script from 'next/script';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

import { AppBootstrap } from '@/components/AppBootstrap';
import { BotDeletedOverlay } from '@/components/BotDeletedOverlay';
import { ToastProvider } from '@/components/ToastProvider';
import { SWRProvider } from '@/hooks/swr';

import './globals.css';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Scheduler',
  description: 'Online booking',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<ReactNode> {
  /***************************************************************************************************
   * Defines the locale value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const locale = await getLocale();
  /***************************************************************************************************
   * Defines the messages value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <Script src={'https://telegram.org/js/telegram-web-app.js'} />
        {/***************************************************************************************************
         * Detect dark/light theme early to prevent flash.
         ***************************************************************************************************/}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var p=localStorage.getItem('theme-preference'),r=document.documentElement,s=r.style;if(p==='dark'){r.classList.add('dark');s.setProperty('--tg-theme-bg-color','#17212b');s.setProperty('--tg-theme-text-color','#ffffff');s.setProperty('--tg-theme-hint-color','#708499');s.setProperty('--tg-theme-link-color','#6ab3f3');s.setProperty('--tg-theme-button-color','#5288c1');s.setProperty('--tg-theme-button-text-color','#ffffff');s.setProperty('--tg-theme-secondary-bg-color','#232e3c');s.setProperty('--tg-theme-header-bg-color','#17212b');s.setProperty('--tg-theme-section-bg-color','#232e3c');s.setProperty('--tg-theme-subtitle-text-color','#708499');s.setProperty('--tg-theme-destructive-text-color','#ec3942')}else if(p==='light'){r.classList.remove('dark');s.setProperty('--tg-theme-bg-color','#ffffff');s.setProperty('--tg-theme-text-color','#000000');s.setProperty('--tg-theme-secondary-bg-color','#efeff4')}else{var t=window.Telegram&&window.Telegram.WebApp;if(t&&t.colorScheme==='dark'){r.classList.add('dark')}}}catch(e){}})()",
          }}
        />
      </head>
      <body>
        <AppBootstrap />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SWRProvider>{children}</SWRProvider>
          <BotDeletedOverlay />
        </NextIntlClientProvider>
        <ToastProvider />
      </body>
    </html>
  );
}
