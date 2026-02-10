import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["sr", "ru", "en"],
  defaultLocale: "sr",
  localePrefix: "as-needed",
});
