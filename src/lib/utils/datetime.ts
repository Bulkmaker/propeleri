const BELGRADE_TIME_ZONE = "Europe/Belgrade";

type DateInput = Date | string | null | undefined;

type DateTimeParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

function parseDateInput(value: DateInput): Date | null {
  if (!value) return null;

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

function getDateTimeParts(date: Date, timeZone: string): DateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: valueByType.get("year") ?? "0000",
    month: valueByType.get("month") ?? "01",
    day: valueByType.get("day") ?? "01",
    hour: valueByType.get("hour") ?? "00",
    minute: valueByType.get("minute") ?? "00",
    second: valueByType.get("second") ?? "00",
  };
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = getDateTimeParts(date, timeZone);
  const asUtcTimestamp = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return (asUtcTimestamp - date.getTime()) / 60000;
}

function parseDateTimeLocal(value: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    return null;
  }

  const validation = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (
    validation.getUTCFullYear() !== year ||
    validation.getUTCMonth() !== month - 1 ||
    validation.getUTCDate() !== day ||
    validation.getUTCHours() !== hour ||
    validation.getUTCMinutes() !== minute
  ) {
    return null;
  }

  return { year, month, day, hour, minute };
}

export function formatInBelgrade(
  value: DateInput,
  locale: string,
  options: Intl.DateTimeFormatOptions
): string {
  const parsed = parseDateInput(value);
  if (!parsed) return "";

  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: BELGRADE_TIME_ZONE,
  }).format(parsed);
}

export function utcToBelgradeDateTimeLocalInput(value: string | null | undefined): string {
  const parsed = parseDateInput(value);
  if (!parsed) return "";

  const parts = getDateTimeParts(parsed, BELGRADE_TIME_ZONE);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function belgradeDateTimeLocalInputToUtcIso(value: string): string | null {
  const parsed = parseDateTimeLocal(value.trim());
  if (!parsed) return null;

  const utcGuess = Date.UTC(
    parsed.year,
    parsed.month - 1,
    parsed.day,
    parsed.hour,
    parsed.minute,
    0,
    0
  );

  let offsetMinutes = getTimeZoneOffsetMinutes(new Date(utcGuess), BELGRADE_TIME_ZONE);
  let resolvedTimestamp = utcGuess - offsetMinutes * 60_000;

  const resolvedOffsetMinutes = getTimeZoneOffsetMinutes(
    new Date(resolvedTimestamp),
    BELGRADE_TIME_ZONE
  );
  if (resolvedOffsetMinutes !== offsetMinutes) {
    offsetMinutes = resolvedOffsetMinutes;
    resolvedTimestamp = utcGuess - offsetMinutes * 60_000;
  }

  return new Date(resolvedTimestamp).toISOString();
}

export function belgradeMinuteKey(value: string): string {
  const parsed = parseDateInput(value);
  if (!parsed) return value.slice(0, 16);

  return utcToBelgradeDateTimeLocalInput(parsed.toISOString());
}

export { BELGRADE_TIME_ZONE };
