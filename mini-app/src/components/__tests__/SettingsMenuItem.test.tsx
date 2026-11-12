import { render, screen } from '@testing-library/react';
import { Clock } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { SettingsMenuItem } from '../SettingsMenuItem';

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/settings' }));

describe('SettingsMenuItem', () => {
  it('renders a subtitle under the label', () => {
    render(
      <SettingsMenuItem icon={Clock} label={'Кабинет'} subtitle={'Работаю один'} href={'/x'} />,
    );
    const link = screen.getByRole('link');
    expect(link.textContent).toContain('Кабинет');
    expect(screen.getByText('Работаю один')).toBeTruthy();
  });

  it('keeps the original layout without a subtitle', () => {
    render(<SettingsMenuItem icon={Clock} label={'Расписание'} value={'9-18'} href={'/y'} />);
    expect(screen.getByText('Расписание').className).toContain('flex-1');
    expect(screen.getByText('9-18')).toBeTruthy();
  });
});
