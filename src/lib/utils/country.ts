const COUNTRY_ALIASES: Record<string, string> = {
  serbia: "RS",
  srbija: "RS",
  russia: "RU",
  russian_federation: "RU",
  usa: "US",
  us: "US",
  united_states: "US",
  canada: "CA",
  czechia: "CZ",
  czech_republic: "CZ",
  slovakia: "SK",
  sweden: "SE",
  finland: "FI",
  norway: "NO",
  denmark: "DK",
  germany: "DE",
  deutschland: "DE",
  austria: "AT",
  switzerland: "CH",
  slovenia: "SI",
  croatia: "HR",
  bosnia_and_herzegovina: "BA",
  montenegro: "ME",
  north_macedonia: "MK",
  macedonia: "MK",
  romania: "RO",
  hungary: "HU",
  poland: "PL",
  italy: "IT",
  france: "FR",
  uk: "GB",
  united_kingdom: "GB",
  ukraine: "UA",
  latvia: "LV",
  lithuania: "LT",
  estonia: "EE",
};

function normalizeCountryName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

export function resolveCountryCode(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  if (!cleaned) return null;

  if (/^[a-z]{2}$/i.test(cleaned)) {
    return cleaned.toUpperCase();
  }

  return COUNTRY_ALIASES[normalizeCountryName(cleaned)] ?? null;
}

export function countryFlagFromValue(value: string | null | undefined): string | null {
  const code = resolveCountryCode(value);
  if (!code || code.length !== 2) return null;

  return String.fromCodePoint(...code.split("").map((char) => 127397 + char.charCodeAt(0)));
}
