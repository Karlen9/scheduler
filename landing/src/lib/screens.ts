export type TScreenKey = 'booking' | 'bookings' | 'calendar' | 'slots';

export type TScreen = { src: string; statusBg: string };

// Swap a CSS mock for a real screenshot: put the PNG in public/screens/ and set
// { src: '/screens/booking.png', statusBg: '#ffffff' }. Screenshots are taken without the iOS
// status bar; statusBg is the colour of the screenshot's top edge, painted behind the status bar
// drawn above it. null keeps the built-in mock.
export const SCREENS: Record<TScreenKey, TScreen | null> = {
  booking: { src: '/screens/booking.png', statusBg: '#ffffff' },
  bookings: { src: '/screens/bookings.png', statusBg: '#efeff4' },
  calendar: { src: '/screens/calendar.png', statusBg: '#ffffff' },
  slots: { src: '/screens/slots.png', statusBg: '#efeff4' },
};
