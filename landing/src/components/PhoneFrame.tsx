import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { SCREENS } from '@/lib/screens';

import { MockBooking } from './mocks/MockBooking';
import { MockCalendar } from './mocks/MockCalendar';
import { MockRequest } from './mocks/MockRequest';
import { HomeIndicator, StatusBar } from './mocks/StatusBar';

import type { TScreenKey } from '@/lib/screens';
import type { ReactNode } from 'react';

type TPhoneFrameProps = {
  screen: TScreenKey;
  className?: string;
  priority?: boolean;
};

const MOCKS: Record<TScreenKey, () => ReactNode> = {
  booking: MockBooking,
  calendar: MockCalendar,
  request: MockRequest,
};

// Side hardware as [top %, height %] of the body height.
const LEFT_BUTTONS = [
  [19, 3],
  [25, 6],
  [33, 6],
] as const;
const POWER_BUTTON = [29, 11] as const;
const CAMERA_CONTROL = [62, 8] as const;

// The parent sets the width. Body is 780:1634, the screen 1320:2868 with an even border, and
// everything inside is sized in container units so the whole phone scales as one piece.
export function PhoneFrame({
  screen,
  className = '',
  priority = false,
}: TPhoneFrameProps): ReactNode {
  const t = useTranslations('phones');
  const src = SCREENS[screen];
  const Mock = MOCKS[screen];
  const alt = t(screen);

  return (
    <div {...(src ? {} : { role: 'img', 'aria-label': alt })} className={`@container ${className}`}>
      <div className={'phone relative aspect-[780/1634] w-full'}>
        {LEFT_BUTTONS.map(([top, height]) => (
          <span
            key={top}
            aria-hidden={'true'}
            className={'phone-btn phone-btn-left'}
            style={{ top: `${top}%`, height: `${height}%` }}
          />
        ))}
        <span
          aria-hidden={'true'}
          className={'phone-btn phone-btn-right'}
          style={{ top: `${POWER_BUTTON[0]}%`, height: `${POWER_BUTTON[1]}%` }}
        />
        <span
          aria-hidden={'true'}
          className={'phone-btn phone-btn-right phone-btn-flush'}
          style={{ top: `${CAMERA_CONTROL[0]}%`, height: `${CAMERA_CONTROL[1]}%` }}
        />
        <div className={'phone-body'}>
          <div className={'phone-bezel'} />
          <div className={'phone-screen'}>
            {src ? (
              <Image
                src={src}
                alt={alt}
                fill
                priority={priority}
                sizes={'(min-width: 1024px) 272px, 240px'}
                className={'object-cover'}
              />
            ) : (
              <div aria-hidden={'true'} className={'h-full w-full'}>
                <Mock />
                <StatusBar />
                <HomeIndicator />
              </div>
            )}
            <span aria-hidden={'true'} className={'phone-island'} />
          </div>
        </div>
      </div>
    </div>
  );
}
