import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DaysOffPage from '../page';

const batchSpy = vi.fn().mockResolvedValue([]);
const deleteSpy = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/api', () => ({
  api: {
    admin: {
      createDayOffsBatch: (...args: unknown[]) => batchSpy(...args),
      deleteDayOff: (...args: unknown[]) => deleteSpy(...args),
    },
  },
}));

const mutateSpy = vi.fn().mockResolvedValue(undefined);
vi.mock('@/hooks/queries', () => ({
  useAdminDaysOff: () => ({
    data: [],
    isLoading: false,
    error: undefined,
    mutate: mutateSpy,
  }),
}));

vi.mock('@/hooks/mutations', () => ({
  invalidateDaysOff: vi.fn(),
}));

vi.mock('@/components/TopBar', () => ({
  TopBar: ({ title }: { title: string }): React.ReactNode => <div>{title}</div>,
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const messages = {
  AdminDaysOff: {
    title: 'Выходные дни',
    selectDate: 'Выберите дату',
    reasonLabel: 'Причина',
    reasonPlaceholder: '',
    addDayOff: 'Добавить выходной',
    addDaysOff: 'Добавить {count} дн.',
    empty: 'Нет',
    modeSingle: 'По одному',
    modeRange: 'Диапазон',
    rangePickStart: 'Выберите начало',
    rangePickEnd: 'Выберите конец',
    rangeSummary: '{from} → {to} ({count} дн.)',
    selectedCount: 'Выбрано: {count}',
    selectDates: 'Выберите даты',
  },
  Common: { loading: 'Загрузка', saving: 'Сохранение' },
  Errors: { addDayOffFailed: 'Ошибка', deleteDayOffFailed: 'Ошибка' },
  Dates: {
    daysShort: { sun: 'Вс', mon: 'Пн', tue: 'Вт', wed: 'Ср', thu: 'Чт', fri: 'Пт', sat: 'Сб' },
    monthsNom: {
      jan: 'Январь',
      feb: 'Февраль',
      mar: 'Март',
      apr: 'Апрель',
      may: 'Май',
      jun: 'Июнь',
      jul: 'Июль',
      aug: 'Август',
      sep: 'Сентябрь',
      oct: 'Октябрь',
      nov: 'Ноябрь',
      dec: 'Декабрь',
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
};

function renderPage(): ReturnType<typeof render> {
  return render(
    <NextIntlClientProvider locale={'ru'} messages={messages}>
      <DaysOffPage />
    </NextIntlClientProvider>,
  );
}

function pickDay(n: number): HTMLButtonElement {
  const span = screen.getAllByText(String(n)).find((el) => el.tagName === 'SPAN');
  return span!.closest('button') as HTMLButtonElement;
}

describe('DaysOffPage range picker', () => {
  beforeEach(() => {
    batchSpy.mockClear();
    mutateSpy.mockClear();
  });

  it('submits a date range picked directly in range mode', async () => {
    renderPage();
    fireEvent.click(screen.getByText('Добавить выходной'));
    fireEvent.click(screen.getByText('Диапазон'));
    fireEvent.click(pickDay(10));
    fireEvent.click(pickDay(15));

    fireEvent.click(await screen.findByRole('button', { name: /Добавить/ }));

    await waitFor(() => expect(batchSpy).toHaveBeenCalled());
    expect((batchSpy.mock.calls[0][0] as string[]).length).toBe(6);
  });

  it('preserves a single-mode pick when user switches to range and picks the other endpoint', async () => {
    renderPage();
    fireEvent.click(screen.getByText('Добавить выходной'));

    /***************************************************************************************************
     * User picks a date in single mode, then changes their mind and switches to range, then
     * picks the end date. Prior to the fix this dropped the first pick on the floor — only the
     * second click became the range, and a single-day "range" got submitted instead of the span.
     ***************************************************************************************************/
    fireEvent.click(pickDay(10));
    fireEvent.click(screen.getByText('Диапазон'));
    fireEvent.click(pickDay(15));

    fireEvent.click(await screen.findByRole('button', { name: /Добавить/ }));

    await waitFor(() => expect(batchSpy).toHaveBeenCalled());
    expect((batchSpy.mock.calls[0][0] as string[]).length).toBe(6);
  });
});
