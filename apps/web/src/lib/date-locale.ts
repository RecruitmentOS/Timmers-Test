import { nl } from "date-fns/locale";
import { en } from "date-fns/locale/en-US";

/**
 * Returns the date-fns locale matching the current cookie-based locale.
 * Falls back to Dutch (NL) as the default.
 */
export function getDateLocale(): typeof nl {
  if (typeof document !== "undefined") {
    const cookie = document.cookie
      .split("; ")
      .find((c) => c.startsWith("NEXT_LOCALE="));
    if (cookie?.split("=")[1] === "en") return en;
  }
  return nl;
}
