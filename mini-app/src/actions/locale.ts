'use server';

import { cookies } from 'next/headers';

/***************************************************************************************************
 * Sets locale.
 *
 * Parameters:
 * - locale: Locale used by the current operation.
 *
 * Returns:
 * - A promise that resolves with void.
 *
 * Side effects:
 * - Keeps work scoped to the current module unless downstream helpers perform I/O.
 ***************************************************************************************************/
export async function setLocale(locale: string): Promise<void> {
  /***************************************************************************************************
   * Defines the supported value used by the current module.
   *
   * Usage context:
   * - Reused by the current module to keep shared values centralized.
   ***************************************************************************************************/
  const supported = ['ru', 'en'];
  /***************************************************************************************************
   * Defines the safe value used by the current module.
   *
   * Usage context:
   * - Reused by the current module to keep shared values centralized.
   ***************************************************************************************************/
  const safe = supported.includes(locale) ? locale : 'ru';
  /***************************************************************************************************
   * Defines the store value used by the current module.
   *
   * Usage context:
   * - Reused by the current module to keep shared values centralized.
   ***************************************************************************************************/
  const store = await cookies();
  store.set('locale', safe, { path: '/', maxAge: 60 * 60 * 24 * 365 });
}
