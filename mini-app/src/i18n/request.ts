import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

/***************************************************************************************************
 * Defines the supported locales value used by the current module.
 *
 * Usage context:
 * - Reused by the current module to keep shared values centralized.
 ***************************************************************************************************/
const supportedLocales = ['ru', 'en'];

export default getRequestConfig(async () => {
  /***************************************************************************************************
   * Defines the store value used by the current module.
   *
   * Usage context:
   * - Reused by the current module to keep shared values centralized.
   ***************************************************************************************************/
  const store = await cookies();
  /***************************************************************************************************
   * Defines the raw value used by the current module.
   *
   * Usage context:
   * - Reused by the current module to keep shared values centralized.
   ***************************************************************************************************/
  const raw = store.get('locale')?.value || 'ru';
  /***************************************************************************************************
   * Defines the locale value used by the current module.
   *
   * Usage context:
   * - Reused by the current module to keep shared values centralized.
   ***************************************************************************************************/
  const locale = supportedLocales.includes(raw) ? raw : 'ru';

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
