import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookingCard } from '@/components/BookingCard';
import { Booking } from '@/lib/types';
import { renderWithIntl } from '@/__tests__/mocks';

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'test-booking-1',
    startsAt: '2026-06-15T10:00:00Z',
    endsAt: '2026-06-15T11:00:00Z',
    clientName: 'Test Client',
    status: 'confirmed',
    durationMinutes: 60,
    ...overrides,
  };
}

describe('BookingCard', () => {
  it('renders booking date', () => {
    renderWithIntl(<BookingCard booking={makeBooking()} />);
    expect(screen.getByText(/15 июня 2026/)).toBeInTheDocument();
  });

  it('renders status badge', () => {
    renderWithIntl(<BookingCard booking={makeBooking({ status: 'confirmed' })} />);
    expect(screen.getByText('Подтверждено')).toBeInTheDocument();
  });

  it('renders duration', () => {
    renderWithIntl(<BookingCard booking={makeBooking({ durationMinutes: 60 })} />);
    expect(screen.getByText(/60/)).toBeInTheDocument();
    expect(screen.getByText(/мин/)).toBeInTheDocument();
  });

  it('renders session label', () => {
    renderWithIntl(<BookingCard booking={makeBooking()} />);
    expect(screen.getByText(/Сеанс/)).toBeInTheDocument();
  });

  it('shows cancel button for confirmed bookings', async () => {
    const onCancel = vi.fn();
    const booking = makeBooking({ status: 'confirmed' });
    renderWithIntl(<BookingCard booking={booking} onCancel={onCancel} />);
    const cancelButton = screen.getByRole('button', { name: 'Отменить' });
    expect(cancelButton).toBeInTheDocument();
    await userEvent.click(cancelButton);
    expect(onCancel).toHaveBeenCalledWith(booking);
  });

  it('shows cancel button for pending client-created bookings', () => {
    const onCancel = vi.fn();
    renderWithIntl(
      <BookingCard
        booking={makeBooking({ status: 'pending', createdBy: 'client' })}
        onCancel={onCancel}
      />,
    );
    const cancelButton = screen.getByRole('button', { name: 'Отменить' });
    expect(cancelButton).toBeInTheDocument();
  });

  it('shows confirm and decline for trainer-created pending bookings', async () => {
    const onConfirm = vi.fn();
    const onDecline = vi.fn();
    const booking = makeBooking({ status: 'pending', createdBy: 'trainer' });
    renderWithIntl(<BookingCard booking={booking} onConfirm={onConfirm} onDecline={onDecline} />);

    expect(screen.getByText('Специалист записал вас')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Подтвердить' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отклонить' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));
    expect(onConfirm).toHaveBeenCalledWith(booking);

    await userEvent.click(screen.getByRole('button', { name: 'Отклонить' }));
    expect(onDecline).toHaveBeenCalledWith(booking);
  });

  it('hides buttons for completed bookings', () => {
    renderWithIntl(<BookingCard booking={makeBooking({ status: 'completed' })} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('hides buttons for cancelled bookings', () => {
    renderWithIntl(<BookingCard booking={makeBooking({ status: 'cancelled' })} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
