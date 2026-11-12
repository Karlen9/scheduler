import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import ru from '../../../messages/ru.json';
import { MonthGrid, WeekStrip } from '../Calendar';

import type { TMonthGridProps } from '@/lib/types';

// November 2026: the 19th is a Thursday, the 21st a Saturday.
const NOV = new Date(2026, 10, 1);

function renderGrid(props: Partial<TMonthGridProps> = {}): ReturnType<typeof render> {
  return render(
    <NextIntlClientProvider locale={'ru'} messages={ru}>
      <MonthGrid
        displayDate={NOV}
        selectedDate={null}
        onSelectDate={() => undefined}
        onPrevMonth={() => undefined}
        onNextMonth={() => undefined}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

function day(iso: string): HTMLButtonElement {
  return screen.getByTestId(`calendar-day-${iso}`) as HTMLButtonElement;
}

describe('MonthGrid openDates', () => {
  it('disables every date outside the set when openDates is provided', () => {
    renderGrid({ openDates: new Set(['2026-11-20']) });

    expect(day('2026-11-20').disabled).toBe(false);
    expect(day('2026-11-19').disabled).toBe(true);
    expect(day('2026-11-21').disabled).toBe(true);
  });

  it('does not select a closed date on click', () => {
    const onSelect = vi.fn();
    renderGrid({ openDates: new Set(['2026-11-20']), onSelectDate: onSelect });

    fireEvent.click(day('2026-11-19'));
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(day('2026-11-20'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('closes everything when the set is empty', () => {
    renderGrid({ openDates: new Set() });
    expect(day('2026-11-20').disabled).toBe(true);
  });

  it('keeps closed dates clickable when non-working dates are not disabled', () => {
    renderGrid({ openDates: new Set(['2026-11-20']), disableNonWorking: false });
    expect(day('2026-11-19').disabled).toBe(false);
  });

  it('behaves as before when openDates is absent', () => {
    renderGrid({ nonWorkingDays: [6], daysOff: ['2026-11-19'] });

    expect(day('2026-11-20').disabled).toBe(false);
    expect(day('2026-11-21').disabled).toBe(true); // Saturday
    expect(day('2026-11-19').disabled).toBe(true); // day off
  });

  it('renders a mark under dates in markedDates', () => {
    renderGrid({ markedDates: new Set(['2026-11-20']) });
    expect(screen.getByTestId('calendar-mark-2026-11-20')).toBeTruthy();
    expect(screen.queryByTestId('calendar-mark-2026-11-19')).toBeNull();
  });
});

describe('MonthGrid dayColors', () => {
  it('fills coloured days with their owner colour and keeps others plain', () => {
    renderGrid({ dayColors: new Map([['2026-11-20', 'var(--room-violet)']]) });

    const coloured = day('2026-11-20').querySelector('span') as HTMLElement;
    expect(coloured.style.backgroundColor).toBe('var(--room-violet)');
    expect(coloured.className).toContain('text-white');
    expect((day('2026-11-21').querySelector('span') as HTMLElement).style.backgroundColor).toBe('');
  });

  it('keeps coloured past days disabled and dimmed', () => {
    renderGrid({
      dayColors: new Map([['2000-01-01', 'var(--room-green)']]),
      displayDate: new Date(2000, 0, 1),
      disablePast: true,
    });

    expect(day('2000-01-01').disabled).toBe(true);
    expect((day('2000-01-01').querySelector('span') as HTMLElement).className).toContain(
      'opacity-50',
    );
  });
});

describe('WeekStrip openDates', () => {
  it('disables days that are not open', () => {
    render(
      <NextIntlClientProvider locale={'ru'} messages={ru}>
        <WeekStrip
          selectedDate={new Date(2026, 10, 19)}
          onSelectDate={() => undefined}
          onPrevWeek={() => undefined}
          onNextWeek={() => undefined}
          openDates={new Set(['2026-11-19'])}
        />
      </NextIntlClientProvider>,
    );

    const dayButtons = screen
      .getAllByRole('button')
      .filter((b) => /^(Пн|Вт|Ср|Чт|Пт|Сб|Вс)\s*\d+$/.test(b.textContent ?? ''));
    expect(dayButtons).toHaveLength(7);
    const enabled = dayButtons.filter((b) => !(b as HTMLButtonElement).disabled);
    expect(enabled).toHaveLength(1);
    expect(enabled[0].textContent).toContain('19');
  });
});
