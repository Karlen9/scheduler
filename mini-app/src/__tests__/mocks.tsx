import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

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
    workout: 'Тренировка',
    min: 'мин',
    confirm: 'Подтвердить',
    cancelVerb: 'Отменить',
  },
  BookingsPage: {
    trainerBookedYou: 'Тренер записал вас',
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

export function renderWithIntl(ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <NextIntlClientProvider locale="ru" messages={messages}>
        {children}
      </NextIntlClientProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...options });
}
