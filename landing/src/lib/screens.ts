export type TScreenKey = 'booking' | 'calendar' | 'request';

// Swap a CSS mock for a real screenshot: put the PNG in public/screens/ and set its path,
// e.g. booking: '/screens/booking.png'. null keeps the built-in mock.
export const SCREENS: Record<TScreenKey, string | null> = {
  booking: null,
  calendar: null,
  request: null,
};
