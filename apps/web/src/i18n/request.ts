import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const locales = ["nl", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "nl";

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale =
    (store.get("NEXT_LOCALE")?.value as Locale) || defaultLocale;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
