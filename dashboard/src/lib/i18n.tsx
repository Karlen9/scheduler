"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { ReactNode } from "react";

export type DashboardLanguage = "en" | "ru";

const storageKey = "dashboard_language";

const ru: Record<string, string> = {
  Action: "Действие",
  "Action failed.": "Действие не выполнено.",
  Actions: "Действия",
  Active: "Активен",
  "Active referred specialists": "Активные приглашенные специалисты",
  Activity: "Активность",
  Actor: "Администратор",
  "Add day off": "Добавить выходной",
  Admins: "Админы",
  All: "Все",
  Apply: "Применить",
  Approve: "Одобрить",
  "Audit log": "Журнал действий",
  "Audit trail": "История действий",
  Backend: "Бэкенд",
  Batch: "Пакет",
  "Batch assigned.": "Пакет назначен.",
  "Batch service ID": "ID пакетной услуги",
  "Batch sessions": "Сессий в пакете",
  Bio: "Описание",
  Block: "Заблокировать",
  "Booking created.": "Запись создана.",
  "Booking funnel": "Воронка записей",
  "Booking rescheduled.": "Запись перенесена.",
  "Booking updated.": "Запись обновлена.",
  Bookings: "Записи",
  "Bookings, 30d": "Записи за 30 дней",
  Bot: "Бот",
  "Busiest hours": "Самые загруженные часы",
  Calendar: "Календарь",
  Cancel: "Отменить",
  "Cancel active bookings and recurring schedules for this client?":
    "Отменить активные записи и повторяющиеся расписания этого клиента?",
  "Cancel this recurring schedule?": "Отменить это повторяющееся расписание?",
  Cancellation: "Отмены",
  "Cancellation by service": "Отмены по услугам",
  "Cancellation by specialist": "Отмены по специалистам",
  "Cancellation sources": "Источники отмен",
  Cancellations: "Отмены",
  Cancelled: "Отменено",
  "Capacity, 7d": "Загрузка за 7 дней",
  Check: "Проверить",
  Client: "Клиент",
  "Client added": "Клиент добавлен",
  "Client blocked.": "Клиент заблокирован.",
  "Client cancelled": "Клиент отменил",
  "Client created.": "Клиент создан.",
  "Client display name": "Отображаемое имя клиента",
  "Client referrals": "Приглашенные клиенты",
  "Client renamed.": "Клиент переименован.",
  "Client unblocked.": "Клиент разблокирован.",
  Clients: "Клиенты",
  Code: "Код",
  Common: "Обычная",
  Complete: "Завершить",
  Completed: "Завершено",
  Completion: "Завершение",
  Confirm: "Подтвердить",
  Confirmed: "Подтверждено",
  "Conflict detector": "Проверка конфликтов",
  Create: "Создать",
  "Create booking": "Создать запись",
  "Create ghost": "Создать офлайн-клиента",
  "Create service": "Создать услугу",
  Created: "Создано",
  Currency: "Валюта",
  "Danger zone": "Опасная зона",
  Database: "База данных",
  "Day off added.": "Выходной добавлен.",
  "Day off deleted.": "Выходной удален.",
  Days: "Дни",
  "Days off": "Выходные",
  Deactivate: "Деактивировать",
  "Deactivate this service?": "Деактивировать эту услугу?",
  Decline: "Отклонить",
  Delete: "Удалить",
  Deleted: "Удален",
  Disable: "Отключить",
  "Disable this specialist bot? Existing data stays in place.":
    "Отключить бота специалиста? Данные останутся на месте.",
  Duration: "Длительность",
  Edit: "Изменить",
  Enable: "Включить",
  "Enable this specialist bot?": "Включить бота специалиста?",
  English: "English",
  Event: "Событие",
  "Export CSV": "Экспорт CSV",
  "Failed to load dashboard.": "Не удалось загрузить дашборд.",
  Fri: "Пт",
  "Funnel completion": "Конверсия воронки",
  "Ghost client name": "Имя офлайн-клиента",
  "Global search": "Глобальный поиск",
  Inactive: "Неактивен",
  "JSON preserves multiple intervals per day.":
    "JSON сохраняет несколько интервалов на день.",
  Language: "Язык",
  "Live activity": "Живая активность",
  Load: "Загрузить",
  "Loading Telegram login...": "Загружаем вход через Telegram...",
  "Loading checks...": "Загружаем проверки...",
  "Loading dashboard...": "Загружаем дашборд...",
  "Loading specialist data...": "Загружаем данные специалиста...",
  "Log out": "Выйти",
  Message: "Сообщение",
  Minutes: "Минуты",
  Missing: "Не настроено",
  Mon: "Пн",
  "Monthly activity": "Активность по месяцам",
  Move: "Перенести",
  Name: "Имя",
  "New bookings": "Новые записи",
  "New date YYYY-MM-DD": "Новая дата ГГГГ-ММ-ДД",
  "New time HH:MM": "Новое время ЧЧ:ММ",
  "No ADMIN_IDS loaded": "ADMIN_IDS не загружены",
  "No activity yet.": "Активности пока нет.",
  "No bookings in this range.": "В этом диапазоне нет записей.",
  "No completed paid bookings yet.": "Платных завершенных записей пока нет.",
  "No conflicts detected.": "Конфликты не найдены.",
  "No currency": "Нет валюты",
  "No dashboard actions recorded yet.": "Действий в дашборде пока нет.",
  "No data yet.": "Данных пока нет.",
  "No overview data loaded.": "Сводка не загружена.",
  "No reason": "Без причины",
  "No referred clients yet.": "Приглашенных клиентов пока нет.",
  "No referred specialists yet.": "Приглашенных специалистов пока нет.",
  "No revenue yet.": "Выручки пока нет.",
  None: "Нет",
  Notifications: "Уведомления",
  "Notifications saved.": "Уведомления сохранены.",
  OK: "ОК",
  Open: "Открыть",
  Ops: "Операции",
  Overview: "Обзор",
  "Owner console": "Консоль владельца",
  "Owner dashboard": "Дашборд владельца",
  Pending: "Ожидает",
  Phone: "Телефон",
  "Photo URL or file id": "URL фото или file id",
  "Platform calendar": "Календарь платформы",
  "Platform overview": "Обзор платформы",
  Price: "Цена",
  Profile: "Профиль",
  "Profile saved.": "Профиль сохранен.",
  Reason: "Причина",
  "Recent activity": "Недавняя активность",
  "Recent bookings": "Недавние записи",
  Recurring: "Повторы",
  "Recurring schedule cancelled.": "Повторяющееся расписание отменено.",
  "Recurring schedule created": "Повторяющееся расписание создано",
  "Recurring schedule updated.": "Повторяющееся расписание обновлено.",
  "Recurring schedules": "Повторяющиеся расписания",
  "Referral link": "Реферальная ссылка",
  Referrals: "Рефералы",
  "Referred clients": "Приглашенные клиенты",
  "Referred specialists": "Приглашенные специалисты",
  Refresh: "Обновить",
  Reject: "Отклонить",
  Rejected: "Отклонено",
  "Reminder queue": "Очередь напоминаний",
  Rename: "Переименовать",
  "Returning clients": "Повторные клиенты",
  Revenue: "Выручка",
  "Revenue by currency": "Выручка по валютам",
  "Revenue by service": "Выручка по услугам",
  "Revenue by specialist": "Выручка по специалистам",
  Russian: "Русский",
  Sat: "Сб",
  "Save notifications": "Сохранить уведомления",
  "Save profile": "Сохранить профиль",
  "Save working hours": "Сохранить рабочие часы",
  Schedule: "Расписание",
  Scheduler: "Scheduler",
  "Scheduler dashboard": "Дашборд Scheduler",
  Search: "Поиск",
  "Search across specialists, clients, and bookings.":
    "Поиск по специалистам, клиентам и записям.",
  "Select a specialist first.": "Сначала выберите специалиста.",
  "Select a specialist to manage state.":
    "Выберите специалиста для управления состоянием.",
  "Select client": "Выберите клиента",
  "Select service": "Выберите услугу",
  "Selected specialist": "Выбранный специалист",
  Service: "Услуга",
  "Service created.": "Услуга создана.",
  "Service deactivated.": "Услуга деактивирована.",
  "Service name": "Название услуги",
  "Service updated.": "Услуга обновлена.",
  Services: "Услуги",
  Settings: "Настройки",
  "Sign in with the Telegram account listed in ADMIN_IDS to view platform analytics and manage specialists.":
    "Войдите через Telegram-аккаунт из ADMIN_IDS, чтобы смотреть аналитику платформы и управлять специалистами.",
  Specialist: "Специалист",
  "Specialist cancelled": "Специалист отменил",
  "Specialist disabled.": "Специалист отключен.",
  "Specialist enabled.": "Специалист включен.",
  "Specialist onboarded": "Специалист подключен",
  "Specialist referrals": "Приглашенные специалисты",
  "Specialist, client, booking ID, Telegram ID":
    "Специалист, клиент, ID записи, Telegram ID",
  Specialists: "Специалисты",
  Specialization: "Специализация",
  State: "Состояние",
  Status: "Статус",
  Sun: "Вс",
  Telegram: "Telegram",
  "Telegram ID": "Telegram ID",
  "Telegram auth": "Telegram-вход",
  "Telegram handle": "Telegram username",
  "This Telegram account is not allowed.": "Этот Telegram-аккаунт не разрешен.",
  "This month": "Этот месяц",
  Thu: "Чт",
  Time: "Время",
  "Top by bookings": "Топ по записям",
  Total: "Всего",
  Tue: "Вт",
  Unblock: "Разблокировать",
  Wed: "Ср",
  "Working hours": "Рабочие часы",
  "Working hours saved.": "Рабочие часы сохранены.",
  blocked: "заблокирован",
  "clients and specialists": "клиенты и специалисты",
  ghost: "офлайн",
  "invalid interval": "некорректный интервал",
  "overlaps another working interval":
    "пересекается с другим рабочим интервалом",
  passive: "пассивен",
  "whole-bot deletion is not available here":
    "полное удаление бота здесь недоступно",
  min: "мин",
  overlaps: "пересекается с",
  sent: "отправлено",
  "Telegram Login does not work from localhost. Open the dashboard through a public HTTPS domain or tunnel, then set that domain for this bot in BotFather.":
    "Telegram Login не работает с localhost. Откройте дашборд через публичный HTTPS-домен или туннель, затем укажите этот домен для бота в BotFather.",
  "Telegram Login requires HTTPS. Current origin is {{origin}}. Open the dashboard through HTTPS and set that domain for this bot in BotFather.":
    "Telegram Login требует HTTPS. Текущий origin: {{origin}}. Откройте дашборд через HTTPS и укажите этот домен для бота в BotFather.",
  "Telegram login failed.": "Вход через Telegram не выполнен.",
  "Telegram login widget could not be loaded.":
    "Не удалось загрузить виджет входа Telegram.",
  "Telegram login widget did not render. Check NEXT_PUBLIC_TELEGRAM_BOT_USERNAME and BotFather /setdomain.":
    "Виджет Telegram не отобразился. Проверьте NEXT_PUBLIC_TELEGRAM_BOT_USERNAME и /setdomain в BotFather.",
  "NEXT_PUBLIC_TELEGRAM_BOT_USERNAME is not configured.":
    "NEXT_PUBLIC_TELEGRAM_BOT_USERNAME не настроен.",
  "NEXT_PUBLIC_TELEGRAM_BOT_USERNAME must be the bot username from BotFather, for example scheduler_admin_bot. Do not use a bot token, Telegram account username, @ prefix, or t.me link.":
    "NEXT_PUBLIC_TELEGRAM_BOT_USERNAME должен быть username бота из BotFather, например scheduler_admin_bot. Не используйте токен бота, username Telegram-аккаунта, префикс @ или ссылку t.me.",
};

const statusRu: Record<string, string> = {
  active: "активен",
  blocked: "заблокирован",
  cancel_requested: "запрошена отмена",
  cancelled: "отменено",
  completed: "завершено",
  confirmed: "подтверждено",
  deleted: "удален",
  declined: "отклонено",
  inactive: "неактивен",
  passive: "пассивен",
  pending: "ожидает",
  rejected: "отклонено",
  reschedule_pending: "ожидает переноса",
};

const weekdays = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  ru: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
} satisfies Record<DashboardLanguage, string[]>;

let activeLanguage: DashboardLanguage = "en";

function normalizeLanguage(value: string | null): DashboardLanguage {
  return value === "ru" ? "ru" : "en";
}

function interpolate(
  value: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) {
    return value;
  }
  return Object.entries(vars).reduce(
    (result, [key, replacement]) =>
      result.replaceAll(`{{${key}}}`, String(replacement)),
    value,
  );
}

export function dashboardLocale(): string {
  return activeLanguage === "ru" ? "ru-RU" : "en-US";
}

export function translate(
  language: DashboardLanguage,
  key: string,
  vars?: Record<string, string | number>,
): string {
  if (language === "en") {
    return interpolate(key, vars);
  }
  return interpolate(ru[key] ?? key, vars);
}

export function translateStatus(
  language: DashboardLanguage,
  status: string,
): string {
  if (language === "en") {
    return status;
  }
  return statusRu[status] ?? translate(language, status);
}

export function weekdayName(
  language: DashboardLanguage,
  index: number,
): string {
  return weekdays[language][index] ?? String(index);
}

type DashboardI18nValue = {
  language: DashboardLanguage;
  setLanguage: (language: DashboardLanguage) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const DashboardI18nContext = createContext<DashboardI18nValue>({
  language: "en",
  setLanguage: () => undefined,
  t: (key) => key,
});

export function DashboardI18nProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [language, setLanguageState] = useState<DashboardLanguage>("en");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const saved = normalizeLanguage(window.localStorage.getItem(storageKey));
    activeLanguage = saved;
    setLanguageState(saved);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    activeLanguage = language;
    document.documentElement.lang = language;
    window.localStorage.setItem(storageKey, language);
  }, [isHydrated, language]);

  const value = useMemo<DashboardI18nValue>(
    () => ({
      language,
      setLanguage: (nextLanguage) => {
        activeLanguage = nextLanguage;
        setLanguageState(nextLanguage);
      },
      t: (key, vars) => translate(language, key, vars),
    }),
    [language],
  );

  return (
    <DashboardI18nContext.Provider value={value}>
      {children}
    </DashboardI18nContext.Provider>
  );
}

export function useDashboardI18n(): DashboardI18nValue {
  return useContext(DashboardI18nContext);
}

export function LanguageSwitch(): ReactNode {
  const { language, setLanguage, t } = useDashboardI18n();
  return (
    <div className={"language-switch"} aria-label={t("Language")}>
      <button
        className={language === "en" ? "active" : ""}
        onClick={() => setLanguage("en")}
        type={"button"}
      >
        {t("English")}
      </button>
      <button
        className={language === "ru" ? "active" : ""}
        onClick={() => setLanguage("ru")}
        type={"button"}
      >
        {t("Russian")}
      </button>
    </div>
  );
}
