import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BotQrCode } from '@/components/BotQrCode';
import { MASTER_BOT_URL } from '@/lib/site';

const qrProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: (props: Record<string, unknown>) => {
    qrProps.current = props;
    return <svg data-testid={'qr'} />;
  },
}));

describe('BotQrCode', () => {
  it('encodes exactly the master bot url as black on white', () => {
    const { getByRole } = render(<BotQrCode label={'QR label'} />);

    expect(qrProps.current?.value).toBe(MASTER_BOT_URL);
    expect(qrProps.current?.fgColor).toBe('#000000');
    expect(qrProps.current?.bgColor).toBe('#ffffff');
    expect(qrProps.current?.level).toBe('M');
    expect(getByRole('img')).toHaveAttribute('aria-label', 'QR label');
    expect(getByRole('img')).toHaveAttribute('data-qr-value', 'https://t.me/schedu1erbot');
  });
});
