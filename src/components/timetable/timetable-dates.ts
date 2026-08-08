/**
 * Presentation helpers for Timetable local dates and wall-clock times.
 *
 * Timetable stores plain ISO dates (`YYYY-MM-DD`) and local times (`HH:mm`).
 * Every formatter below anchors an ISO date at UTC noon so no browser offset can
 * shift the rendered calendar day.
 */

/** Sunday-based weekday abbreviations used when describing a recurrence. */
export const WEEKDAY_ABBREVIATIONS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Sunday-based two-letter weekday initials used by the recurrence picker. */
export const WEEKDAY_INITIALS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

/** Sunday-based weekday names used when describing a recurrence. */
export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const isoParts = (value: string): readonly [number, number, number] => {
  const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
  return [year, month, day];
};

const atUtcNoon = (value: string): Date => {
  const [year, month, day] = isoParts(value);
  return new Date(Date.UTC(year, month - 1, day, 12));
};

const dayLabelFormat = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const compactDayFormat = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const weekdayShortFormat = new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" });
const dayNumberFormat = new Intl.DateTimeFormat("en", { day: "numeric", timeZone: "UTC" });
const monthDayFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const monthDayYearFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const monthShortFormat = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });
const timeFormat = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });

/**
 * Render a `Date` as the browser-local calendar day.
 *
 * @param date - The instant to read.
 * @returns The local calendar day as `YYYY-MM-DD`.
 */
export function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Shift an ISO date by whole calendar days without applying a timezone offset.
 *
 * @param value - The ISO date to shift.
 * @param days - The signed number of days to add.
 * @returns The shifted ISO date.
 */
export function shiftDate(value: string, days: number): string {
  const [year, month, day] = isoParts(value);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * List every ISO date in an inclusive range.
 *
 * @param from - The first ISO date.
 * @param to - The last ISO date.
 * @returns The ordered dates, capped at one year to bound accidental ranges.
 */
export function datesBetween(from: string, to: string): ReadonlyArray<string> {
  const dates: Array<string> = [];
  for (let date = from; date <= to && dates.length < 366; date = shiftDate(date, 1)) dates.push(date);
  return dates;
}

/**
 * Format an ISO date as a full agenda heading, such as `Monday, March 3`.
 *
 * @param value - The ISO date to format.
 * @returns The formatted day label.
 */
export function formatDayLabel(value: string): string {
  return dayLabelFormat.format(atUtcNoon(value));
}

/**
 * Format an ISO date compactly, such as `Mon, Mar 3`.
 *
 * @param value - The ISO date to format.
 * @returns The formatted day label.
 */
export function formatCompactDay(value: string): string {
  return compactDayFormat.format(atUtcNoon(value));
}

/**
 * Format an ISO date as an abbreviated weekday, such as `Mon`.
 *
 * @param value - The ISO date to format.
 * @returns The abbreviated weekday.
 */
export function formatWeekdayShort(value: string): string {
  return weekdayShortFormat.format(atUtcNoon(value));
}

/**
 * Format an ISO date as its day-of-month number.
 *
 * @param value - The ISO date to format.
 * @returns The day of the month.
 */
export function formatDayNumber(value: string): string {
  return dayNumberFormat.format(atUtcNoon(value));
}

/**
 * Format an ISO date with its month and year, such as `Mar 3, 2026`.
 *
 * @param value - The ISO date to format.
 * @returns The formatted date.
 */
export function formatFullDate(value: string): string {
  return monthDayYearFormat.format(atUtcNoon(value));
}

/**
 * Format an inclusive date range, collapsing the parts both ends share.
 *
 * @param from - The first ISO date.
 * @param to - The last ISO date.
 * @returns A range such as `Mar 3 – 9, 2026` or `Dec 29, 2026 – Jan 4, 2027`.
 */
export function formatRangeLabel(from: string, to: string): string {
  const [fromYear, fromMonth] = isoParts(from);
  const [toYear, toMonth] = isoParts(to);
  if (fromYear !== toYear) return `${monthDayYearFormat.format(atUtcNoon(from))} – ${monthDayYearFormat.format(atUtcNoon(to))}`;
  if (fromMonth !== toMonth) return `${monthDayFormat.format(atUtcNoon(from))} – ${monthDayYearFormat.format(atUtcNoon(to))}`;
  return `${monthShortFormat.format(atUtcNoon(from))} ${dayNumberFormat.format(atUtcNoon(from))} – ${monthDayYearFormat.format(atUtcNoon(to))}`;
}

/**
 * Format a `HH:mm` wall-clock time for reading, such as `9:00 AM`.
 *
 * @param value - The local time to format.
 * @returns The formatted time.
 */
export function formatTime(value: string): string {
  const [hour = 0, minute = 0] = value.split(":").map(Number);
  return timeFormat.format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}

/**
 * Describe the length of a session, such as `1h 30m`.
 *
 * @param startTime - The local start time.
 * @param endTime - The local end time.
 * @returns The duration label, or an empty string when the range is not positive.
 */
export function formatDuration(startTime: string, endTime: string): string {
  const [startHour = 0, startMinute = 0] = startTime.split(":").map(Number);
  const [endHour = 0, endMinute = 0] = endTime.split(":").map(Number);
  const minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  if (minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/**
 * Describe a weekly recurrence in reading order, such as `Mon, Wed and Fri`.
 *
 * @param daysOfWeek - The Sunday-based weekday indexes.
 * @returns The formatted list, or an empty string when no weekday is selected.
 */
export function formatWeekdayList(daysOfWeek: ReadonlyArray<number>): string {
  const labels = [...daysOfWeek]
    .sort((left, right) => left - right)
    .map((day) => WEEKDAY_ABBREVIATIONS[day])
    .filter((label): label is (typeof WEEKDAY_ABBREVIATIONS)[number] => Boolean(label));
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1) ?? ""}`;
}
