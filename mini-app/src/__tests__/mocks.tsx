import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import React from 'react';

import type { RenderOptions, RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Defines the messages value used by the current module.
 *
 * Usage context:
 * - Reused by the current module to keep shared values centralized.
 ***************************************************************************************************/
const messages = {
  Status: {
    pending: 'Ожидание',
    confirmed: 'Подтверждено',
    rejected: 'Отклонено',
    cancelled: 'Отменено',
    completed: 'Завершено',
    cancelRequested: 'Запрос отмены',
    reschedulePending: 'Перенос',
    active: 'Активно',
    declined: 'Отклонено',
  },
  Common: {
    workout: 'Сеанс',
    min: 'мин',
    confirm: 'Подтвердить',
    cancelVerb: 'Отменить',
    back: 'Назад',
  },
  BookingsPage: {
    specialistBookedYou: 'Специалист записал вас',
    declineButton: 'Отклонить',
  },
  Dates: {
    daysShort: {
      mon: 'Пн',
      tue: 'Вт',
      wed: 'Ср',
      thu: 'Чт',
      fri: 'Пт',
      sat: 'Сб',
      sun: 'Вс',
    },
    monthsShortCap: {
      jan: 'Янв',
      feb: 'Фев',
      mar: 'Мар',
      apr: 'Апр',
      may: 'Мая',
      jun: 'Июн',
      jul: 'Июл',
      aug: 'Авг',
      sep: 'Сен',
      oct: 'Окт',
      nov: 'Ноя',
      dec: 'Дек',
    },
    monthsGen: {
      jan: 'января',
      feb: 'февраля',
      mar: 'марта',
      apr: 'апреля',
      may: 'мая',
      jun: 'июня',
      jul: 'июля',
      aug: 'августа',
      sep: 'сентября',
      oct: 'октября',
      nov: 'ноября',
      dec: 'декабря',
    },
  },
  Analytics: {
    title: 'Аналитика',
    totalSessions: 'Всего сеансов',
    totalHours: 'Всего часов',
    completionRate: 'Завершено',
    sessionsThisMonth: 'В этом месяце',
    patterns: 'Паттерны',
    currentStreak: 'Текущая серия',
    longestStreak: 'Лучшая серия',
    weeks: 'нед.',
    mostCommonDay: 'Частый день',
    mostCommonTime: 'Частое время',
    morning: 'Утро',
    afternoon: 'День',
    evening: 'Вечер',
    byDuration: 'По длительности',
    averageDuration: 'Средняя длительность',
    minutes: 'мин',
    byMonth: 'По месяцам',
    noData: 'Недостаточно данных',
    emptyDescription: 'Запишитесь на сеанс, чтобы увидеть статистику',
  },
  AdminAnalytics: {
    title: 'Аналитика',
    totalBookings: 'Всего записей',
    activeClients: 'Активные клиенты',
    completionRate: 'Завершено',
    bookingsThisMonth: 'В этом месяце',
    vsLastMonth: 'к прошлому месяцу',
    clientInsights: 'Клиенты',
    totalClients: 'Всего клиентов',
    newClients: 'Новых в этом месяце',
    topClients: 'Топ клиенты',
    returningRate: 'Возвращаемость',
    schedule: 'Расписание',
    busiestDay: 'Загруженный день',
    busiestTime: 'Загруженное время',
    avgPerWeek: 'Среднее в неделю',
    cancellationRate: 'Отмены',
    revenue: 'Доход',
    revenueThisMonth: 'В этом месяце',
    revenueLastMonth: 'В прошлом месяце',
    byService: 'По услугам',
    sessions: 'сеансов',
    morning: 'Утро',
    afternoon: 'День',
    evening: 'Вечер',
    noData: 'Недостаточно данных',
    emptyDescription: 'Статистика появится после первых записей',
  },
};

/***************************************************************************************************
 * Renders with intl.
 *
 * Parameters:
 * - ui: Ui used by the current operation.
 * - options: Options used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as RenderResult.
 *
 * Side effects:
 * - Keeps work scoped to the current module unless downstream helpers perform I/O.
 ***************************************************************************************************/
export function renderWithIntl(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
): RenderResult {
  /***************************************************************************************************
   * Renders the wrapper UI and related interactions.
   *
   * Parameters:
   * - props: Component props that drive rendering and callbacks.
   *
   * Returns:
   * - The computed value for the current operation as ReactNode.
   *
   * Side effects:
   * - Keeps work scoped to the current module unless downstream helpers perform I/O.
   ***************************************************************************************************/
  function Wrapper({ children }: { children: React.ReactNode }): ReactNode {
    return (
      <NextIntlClientProvider locale={'ru'} messages={messages}>
        {children}
      </NextIntlClientProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...options });
}
