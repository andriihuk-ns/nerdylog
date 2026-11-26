import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, toLocale } from "@/contracts";

/**
 * A14: locale comes from the NEXT_LOCALE cookie (no URL prefix). Sign-in and the language
 * switcher keep the cookie in sync with users.locale, so no DB read is needed per request.
 * First visit → Ukrainian.
 */
export default getRequestConfig(async () => {
  const locale = toLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return { locale, messages, timeZone: "Europe/Kyiv" };
});
