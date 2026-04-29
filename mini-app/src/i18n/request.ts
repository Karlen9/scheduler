import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

type TLocale = 'en' | 'ru';

const defaultLocale = 'ru';
const messageLoaders = {
  en: async () => import('../../messages/en.json'),
  ru: async () => import('../../messages/ru.json'),
} satisfies Record<TLocale, () => Promise<{ default: object }>>;

export default getRequestConfig(async () => {
  const localeCookie = (await cookies()).get('locale')?.value;
  const locale: TLocale =
    localeCookie === 'en' || localeCookie === 'ru' ? localeCookie : defaultLocale;
  const messages = (await messageLoaders[locale]()).default;

  return {
    locale,
    messages,
  };
});
