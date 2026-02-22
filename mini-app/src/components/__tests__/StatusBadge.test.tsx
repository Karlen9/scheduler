import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithIntl } from '@/__tests__/mocks';
import { StatusBadge, getStatusColor } from '@/components/StatusBadge';

describe('StatusBadge', () => {
  it('renders pending status with correct text', () => {
    renderWithIntl(<StatusBadge status={'pending'} />);
    expect(screen.getByText('Ожидание')).toBeInTheDocument();
  });

  it('renders confirmed status with correct text', () => {
    renderWithIntl(<StatusBadge status={'confirmed'} />);
    expect(screen.getByText('Подтверждено')).toBeInTheDocument();
  });

  it('renders cancelled status with correct text', () => {
    renderWithIntl(<StatusBadge status={'cancelled'} />);
    expect(screen.getByText('Отменено')).toBeInTheDocument();
  });

  it('renders rejected status with correct text', () => {
    renderWithIntl(<StatusBadge status={'rejected'} />);
    expect(screen.getByText('Отклонено')).toBeInTheDocument();
  });

  it('renders completed status with correct text', () => {
    renderWithIntl(<StatusBadge status={'completed'} />);
    expect(screen.getByText('Завершено')).toBeInTheDocument();
  });

  it('falls back to pending for unknown status', () => {
    renderWithIntl(<StatusBadge status={'unknown_status'} />);
    expect(screen.getByText('Ожидание')).toBeInTheDocument();
  });

  it('applies correct CSS classes for confirmed status', () => {
    renderWithIntl(<StatusBadge status={'confirmed'} />);
    const badge = screen.getByText('Подтверждено');
    expect(badge.className).toContain('bg-status-confirmed-bg');
    expect(badge.className).toContain('text-status-confirmed-text');
  });

  it('applies pending CSS classes for unknown status', () => {
    renderWithIntl(<StatusBadge status={'nonexistent'} />);
    const badge = screen.getByText('Ожидание');
    expect(badge.className).toContain('bg-status-pending-bg');
    expect(badge.className).toContain('text-status-pending-text');
  });

  it('applies custom className prop', () => {
    renderWithIntl(<StatusBadge status={'pending'} className={'my-custom-class'} />);
    const badge = screen.getByText('Ожидание');
    expect(badge.className).toContain('my-custom-class');
  });

  it('always includes base badge classes', () => {
    renderWithIntl(<StatusBadge status={'pending'} />);
    const badge = screen.getByText('Ожидание');
    expect(badge.className).toContain('rounded-full');
    expect(badge.className).toContain('text-xs');
    expect(badge.className).toContain('font-medium');
  });
});

describe('getStatusColor', () => {
  it('returns correct color for confirmed status', () => {
    expect(getStatusColor('confirmed')).toBe('bg-status-confirmed-bg text-status-confirmed-text');
  });

  it('returns correct color for cancelled status', () => {
    expect(getStatusColor('cancelled')).toBe('bg-status-cancelled-bg text-status-cancelled-text');
  });

  it('returns pending color for unknown status', () => {
    expect(getStatusColor('nonexistent')).toBe('bg-status-pending-bg text-status-pending-text');
  });

  it('returns correct color for active status', () => {
    expect(getStatusColor('active')).toBe('bg-status-confirmed-bg text-status-confirmed-text');
  });
});
