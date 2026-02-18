import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

const supportedLocales = ["ru", "en"];

export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get("locale")?.value || "ru";
  const locale = supportedLocales.includes(raw) ? raw : "ru";

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
