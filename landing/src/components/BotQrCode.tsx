import { QRCodeSVG } from 'qrcode.react';

import { MASTER_BOT_URL } from '@/lib/site';

import type { ReactNode } from 'react';

type TBotQrCodeProps = {
  label: string;
  className?: string;
};

// Always black on white with a quiet zone, whatever the page theme, so phone cameras read it.
export function BotQrCode({ label, className = '' }: TBotQrCodeProps): ReactNode {
  return (
    <div
      role={'img'}
      aria-label={label}
      data-qr-value={MASTER_BOT_URL}
      className={`inline-block rounded-3xl bg-white p-3 shadow-[0_20px_50px_-20px_rgb(0_0_0/0.45)] ${className}`}
    >
      <QRCodeSVG
        value={MASTER_BOT_URL}
        size={184}
        level={'M'}
        marginSize={2}
        bgColor={'#ffffff'}
        fgColor={'#000000'}
        aria-hidden={'true'}
        className={'block size-[152px] sm:size-[176px] lg:size-[184px]'}
      />
    </div>
  );
}
