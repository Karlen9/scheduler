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
  },
  BookingsPage: {
    specialistBookedYou: 'Специалист записал вас',
    declineButton: 'Отклонить',
  },
  Dates: {
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
