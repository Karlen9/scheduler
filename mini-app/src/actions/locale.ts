'use server';

import { cookies } from 'next/headers';

export async function setLocale(locale: string) {
  const supported = ['ru', 'en'];
  const safe = supported.includes(locale) ? locale : 'ru';
  const store = await cookies();
  store.set('locale', safe, { path: '/', maxAge: 60 * 60 * 24 * 365 });
}
