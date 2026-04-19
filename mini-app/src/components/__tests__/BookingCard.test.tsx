import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithIntl } from '@/__tests__/mocks';
import { BookingCard } from '@/components/BookingCard';

import type { TBooking } from '@/lib/types';

/***************************************************************************************************
 * Implements the make booking logic used by this module.
 *
 * Parameters:
 * - overrides: Overrides used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as TBooking.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
function makeBooking(overrides: Partial<TBooking> = {}): TBooking {
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
    /***************************************************************************************************
     * Defines the on cancel value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const onCancel = vi.fn();
    /***************************************************************************************************
     * Defines the booking value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const booking = makeBooking({ status: 'confirmed' });
    renderWithIntl(<BookingCard booking={booking} onCancel={onCancel} />);
    /***************************************************************************************************
     * Defines the cancel button value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const cancelButton = screen.getByRole('button', { name: 'Отменить' });
    expect(cancelButton).toBeInTheDocument();
    await userEvent.click(cancelButton);
    expect(onCancel).toHaveBeenCalledWith(booking);
  });

  it('shows cancel button for pending client-created bookings', () => {
    /***************************************************************************************************
     * Defines the on cancel value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const onCancel = vi.fn();
    renderWithIntl(
      <BookingCard
        booking={makeBooking({ status: 'pending', createdBy: 'client' })}
        onCancel={onCancel}
      />,
    );
    /***************************************************************************************************
     * Defines the cancel button value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const cancelButton = screen.getByRole('button', { name: 'Отменить' });
    expect(cancelButton).toBeInTheDocument();
  });

  it('shows confirm and decline for specialist-created pending bookings', async () => {
    /***************************************************************************************************
     * Defines the on confirm value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const onConfirm = vi.fn();
    /***************************************************************************************************
     * Defines the on decline value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const onDecline = vi.fn();
    /***************************************************************************************************
     * Defines the booking value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const booking = makeBooking({ status: 'pending', createdBy: 'specialist' });
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

  it('shows approve/decline for reschedule_pending with replacedBooking old→new', async () => {
    const onApprove = vi.fn();
    const onDecline = vi.fn();
    const original = makeBooking({
      id: 'orig',
      status: 'confirmed',
      startsAt: '2026-06-15T10:00:00Z',
      endsAt: '2026-06-15T11:00:00Z',
    });
    const shadow = makeBooking({
      id: 'shadow',
      status: 'reschedule_pending',
      startsAt: '2026-06-17T14:00:00Z',
      endsAt: '2026-06-17T15:00:00Z',
      replacesBookingId: 'orig',
      clientMessage: 'moved because of conflict',
    });

    renderWithIntl(
      <BookingCard
        booking={shadow}
        replacedBooking={original}
        onApproveReschedule={onApprove}
        onDeclineReschedule={onDecline}
      />,
    );

    // Proposed (new) time is the prominent date on the card.
    expect(screen.getByText(/17 июня 2026/)).toBeInTheDocument();
    // Old time is shown with the "was" label.
    expect(screen.getByText(/было/i)).toBeInTheDocument();
    expect(screen.getByText(/15 июня 2026/)).toBeInTheDocument();
    // Admin's note surfaces on the card.
    expect(screen.getByText(/moved because of conflict/)).toBeInTheDocument();

    const accept = screen.getByRole('button', { name: 'Принять новое время' });
    await userEvent.click(accept);
    expect(onApprove).toHaveBeenCalledWith(shadow);

    const reject = screen.getByRole('button', { name: 'Отклонить' });
    await userEvent.click(reject);
    expect(onDecline).toHaveBeenCalledWith(shadow);
  });
});
