'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getTelegramWebApp } from '@/lib/telegram';

import type { TVoidFunction } from '@/lib/types';
import type { ReactNode } from 'react';

type TTelegramBackButtonProviderProps = {
  children: ReactNode;
  isRoot: boolean;
  onBack: TVoidFunction;
};

type TRegisteredBackHandler = {
  id: number;
  handler: TVoidFunction;
};

type TTelegramBackButtonContextValue = {
  registerBackHandler: (handler: TVoidFunction) => TVoidFunction;
};

const TelegramBackButtonContext = createContext<TTelegramBackButtonContextValue | null>(null);

/***************************************************************************************************
 * Coordinates Telegram's native Mini App back button across layout and page-local handlers.
 ***************************************************************************************************/
export function TelegramBackButtonProvider({
  children,
  isRoot,
  onBack,
}: TTelegramBackButtonProviderProps): ReactNode {
  const handlersRef = useRef<TRegisteredBackHandler[]>([]);
  const nextHandlerIdRef = useRef(0);
  const [handlerRevision, setHandlerRevision] = useState(0);

  const registerBackHandler = useCallback((handler: TVoidFunction): TVoidFunction => {
    const entry = { id: nextHandlerIdRef.current, handler };
    nextHandlerIdRef.current += 1;
    handlersRef.current = [...handlersRef.current, entry];
    setHandlerRevision((revision) => revision + 1);

    return () => {
      handlersRef.current = handlersRef.current.filter((item) => item.id !== entry.id);
      setHandlerRevision((revision) => revision + 1);
    };
  }, []);

  useEffect(() => {
    const webApp = getTelegramWebApp();
    if (!webApp) {
      return;
    }

    if (isRoot && handlersRef.current.length === 0) {
      webApp.BackButton.hide();
      return;
    }

    webApp.BackButton.show();

    const handler = (): void => {
      const latestHandler = handlersRef.current[handlersRef.current.length - 1]?.handler;
      if (latestHandler) {
        latestHandler();
        return;
      }

      onBack();
    };

    webApp.BackButton.onClick(handler);
    return () => webApp.BackButton.offClick(handler);
  }, [handlerRevision, isRoot, onBack]);

  const value = useMemo(() => ({ registerBackHandler }), [registerBackHandler]);

  return (
    <TelegramBackButtonContext.Provider value={value}>
      {children}
    </TelegramBackButtonContext.Provider>
  );
}

/***************************************************************************************************
 * Registers a page-local handler for Telegram's native Mini App back button.
 ***************************************************************************************************/
export function useTelegramBackHandler(handler: TVoidFunction | null): void {
  const context = useContext(TelegramBackButtonContext);

  useEffect(() => {
    if (!context || !handler) {
      return;
    }

    return context.registerBackHandler(handler);
  }, [context, handler]);
}
