const DEFAULT_APP_TIME_ZONE = "Asia/Kolkata";

function resolveAppTimeZone() {
  const candidate = process.env.APP_TIME_ZONE?.trim();
  return candidate && candidate.length > 0 ? candidate : DEFAULT_APP_TIME_ZONE;
}

function escapeSqlLiteral(value: string) {
  return value.replace(/'/g, "''");
}

export const APP_TIME_ZONE = resolveAppTimeZone();
const APP_TIME_ZONE_SQL = escapeSqlLiteral(APP_TIME_ZONE);

export function formatDateInAppTimeZone(
  value: string | number | Date,
  locale = "en-IN",
): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

export function formatDateTimeInAppTimeZone(
  value: string | number | Date,
  locale = "en-IN",
): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(parsed);
}

// Use for TIMESTAMPTZ columns when filtering by app business date.
export function appDateFromTimestamptzSql(columnRef: string): string {
  return `((${columnRef}) AT TIME ZONE '${APP_TIME_ZONE_SQL}')::date`;
}

// Use for "today" business-day checks in app timezone.
export function appTodaySql(): string {
  return `(NOW() AT TIME ZONE '${APP_TIME_ZONE_SQL}')::date`;
}
