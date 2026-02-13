export type CountryOption = {
  code: string;
  label: string;
  aliases?: string[];
};

export const DEFAULT_COUNTRY_CODE = "RS";

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: "RS", label: "Serbia", aliases: ["Srbija", "Сербия"] },
  { code: "RU", label: "Russia", aliases: ["Россия"] },
  { code: "US", label: "United States", aliases: ["USA", "США"] },
  { code: "CA", label: "Canada" },
  { code: "CZ", label: "Czechia", aliases: ["Czech Republic", "Чехия"] },
  { code: "SK", label: "Slovakia", aliases: ["Словакия"] },
  { code: "SE", label: "Sweden", aliases: ["Швеция"] },
  { code: "FI", label: "Finland", aliases: ["Финляндия"] },
  { code: "NO", label: "Norway", aliases: ["Норвегия"] },
  { code: "DK", label: "Denmark", aliases: ["Дания"] },
  { code: "DE", label: "Germany", aliases: ["Deutschland", "Германия"] },
  { code: "AT", label: "Austria", aliases: ["Австрия"] },
  { code: "CH", label: "Switzerland", aliases: ["Швейцария"] },
  { code: "SI", label: "Slovenia", aliases: ["Словения"] },
  { code: "HR", label: "Croatia", aliases: ["Хорватия"] },
  { code: "BA", label: "Bosnia and Herzegovina", aliases: ["Bosna i Hercegovina", "Босния"] },
  { code: "ME", label: "Montenegro", aliases: ["Црна Гора", "Черногория"] },
  { code: "MK", label: "North Macedonia", aliases: ["Macedonia", "Македония"] },
  { code: "RO", label: "Romania", aliases: ["Румыния"] },
  { code: "HU", label: "Hungary", aliases: ["Венгрия"] },
  { code: "PL", label: "Poland", aliases: ["Польша"] },
  { code: "IT", label: "Italy", aliases: ["Италия"] },
  { code: "FR", label: "France", aliases: ["Франция"] },
  { code: "GB", label: "United Kingdom", aliases: ["UK", "Великобритания"] },
  { code: "UA", label: "Ukraine", aliases: ["Украина"] },
  { code: "LV", label: "Latvia", aliases: ["Латвия"] },
  { code: "LT", label: "Lithuania", aliases: ["Литва"] },
  { code: "EE", label: "Estonia", aliases: ["Эстония"] },
  { code: "EG", label: "Egypt", aliases: ["Egipt", "Египет"] },
];

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolveCountryCode(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  if (!cleaned) return null;

  // Direct 2-letter code match
  const byCode = COUNTRY_OPTIONS.find((option) => option.code === cleaned.toUpperCase());
  if (byCode) return byCode.code;

  // Match by label or alias
  const normalized = normalizeName(cleaned);
  const byName = COUNTRY_OPTIONS.find((option) => {
    if (normalizeName(option.label) === normalized) return true;
    return option.aliases?.some((alias) => normalizeName(alias) === normalized) ?? false;
  });

  return byName?.code ?? null;
}

export function countryDisplayName(value: string | null | undefined): string {
  const cleaned = value?.trim();
  if (!cleaned) return "";

  const code = resolveCountryCode(cleaned);
  if (!code) return cleaned;

  return COUNTRY_OPTIONS.find((option) => option.code === code)?.label ?? cleaned;
}

export function countryFlagEmoji(value: string | null | undefined): string {
  const code = resolveCountryCode(value);
  if (!code || code.length !== 2) return "🏳️";

  return String.fromCodePoint(...code.split("").map((char) => 127397 + char.charCodeAt(0)));
}

/**
 * Returns a flag emoji or null — useful for fallback logic (e.g. TeamAvatar).
 * Unlike countryFlagEmoji, this returns null instead of "🏳️" when no code matches.
 */
export function countryFlagFromValue(value: string | null | undefined): string | null {
  const code = resolveCountryCode(value);
  if (!code || code.length !== 2) return null;

  return String.fromCodePoint(...code.split("").map((char) => 127397 + char.charCodeAt(0)));
}
