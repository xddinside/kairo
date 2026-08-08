import { Schema } from "effect";

const uuid = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)),
);
const isoDate = Schema.String.pipe(Schema.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)));
const localTime = Schema.String.pipe(Schema.check(Schema.isPattern(/^([01]\d|2[0-3]):[0-5]\d$/)));
const title = Schema.String.pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(160)));
const details = Schema.optionalKey(Schema.NullOr(Schema.String.pipe(Schema.check(Schema.isMaxLength(5000)))));
const version = Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0)));
const idempotencyKey = Schema.String.pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(200)));
const dayOfWeek = Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 0, maximum: 6 })));

/** Input for creating a Timetable entry. */
export const CreateTimetableEntry = Schema.Struct({
  title,
  details,
  courseId: Schema.optionalKey(Schema.NullOr(uuid)),
  kind: Schema.Literals(["one_off", "weekly"] as const),
  startDate: isoDate,
  endDate: isoDate,
  daysOfWeek: Schema.Array(dayOfWeek),
  startTime: localTime,
  endTime: localTime,
  idempotencyKey,
});

/** Decoded create input. */
export interface CreateTimetableEntry extends Schema.Schema.Type<typeof CreateTimetableEntry> {}

/** Input for replacing the editable fields of a Timetable entry. */
export const UpdateTimetableEntry = Schema.Struct({
  entryId: uuid,
  expectedVersion: version,
  title,
  details: Schema.NullOr(Schema.String.pipe(Schema.check(Schema.isMaxLength(5000)))),
  courseId: Schema.NullOr(uuid),
  kind: Schema.Literals(["one_off", "weekly"] as const),
  startDate: isoDate,
  endDate: isoDate,
  daysOfWeek: Schema.Array(dayOfWeek),
  startTime: localTime,
  endTime: localTime,
  idempotencyKey,
});

/** Decoded update input. */
export interface UpdateTimetableEntry extends Schema.Schema.Type<typeof UpdateTimetableEntry> {}

/** Input for skipping one generated occurrence. */
export const SkipTimetableOccurrence = Schema.Struct({
  entryId: uuid,
  occurrenceDate: isoDate,
  expectedVersion: version,
  idempotencyKey,
});

/** Decoded occurrence-skip input. */
export interface SkipTimetableOccurrence extends Schema.Schema.Type<typeof SkipTimetableOccurrence> {}

/** Input for deleting a Timetable entry. */
export const DeleteTimetableEntry = Schema.Struct({
  entryId: uuid,
  expectedVersion: version,
  idempotencyKey,
});

/** Decoded delete input. */
export interface DeleteTimetableEntry extends Schema.Schema.Type<typeof DeleteTimetableEntry> {}

/** Input for consuming a Timetable Undo token. */
export const UndoTimetableCommand = Schema.Struct({
  token: Schema.String.pipe(Schema.check(Schema.isMinLength(32), Schema.isMaxLength(256))),
  idempotencyKey,
});

/** Decoded Timetable Undo input. */
export interface UndoTimetableCommand extends Schema.Schema.Type<typeof UndoTimetableCommand> {}

/** A local occurrence produced by one Timetable entry. */
export interface TimetableOccurrence {
  readonly date: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly startInstant: string;
  readonly endInstant: string;
}

/** Timetable entry projected to route and Canvas consumers. */
export interface TimetableEntry {
  readonly id: string;
  readonly title: string;
  readonly details: string | null;
  readonly courseId: string | null;
  readonly courseTitle: string | null;
  readonly kind: "one_off" | "weekly";
  readonly startDate: string;
  readonly endDate: string;
  readonly daysOfWeek: ReadonlyArray<number>;
  readonly startTime: string;
  readonly endTime: string;
  readonly exceptions: ReadonlyArray<string>;
  readonly occurrences: ReadonlyArray<TimetableOccurrence>;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A validation error associated with one form field. */
export interface TimetableFieldError {
  readonly field: string;
  readonly message: string;
}

/** An owned entry whose occurrence overlaps a changed entry. */
export interface TimetableOverlapWarning {
  readonly entryId: string;
  readonly title: string;
  readonly date: string;
  readonly startTime: string;
  readonly endTime: string;
}

/** Result returned by every Timetable mutation. */
export type TimetableCommandResult =
  | { readonly _tag: "applied" | "already_applied"; readonly value: TimetableEntry | null; readonly undoToken?: string; readonly overlapWarnings: ReadonlyArray<TimetableOverlapWarning> }
  | { readonly _tag: "conflict"; readonly current?: TimetableEntry }
  | { readonly _tag: "not_found" }
  | { readonly _tag: "invalid"; readonly fields: ReadonlyArray<TimetableFieldError> };

const dateParts = (value: string): readonly [number, number, number] => {
  const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
  return [year, month, day];
};

const formatDate = (date: Date): string => date.toISOString().slice(0, 10);

/** Return the next Gregorian date without applying a timezone offset. */
export const nextDate = (value: string): string => {
  const [year, month, day] = dateParts(value);
  return formatDate(new Date(Date.UTC(year, month - 1, day + 1)));
};

/** Return the Sunday-based weekday for an ISO date. */
export const weekday = (value: string): number => {
  const [year, month, day] = dateParts(value);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};

/** Determine whether an entry produces an occurrence on one date. */
export const occursOn = (
  entry: Pick<TimetableEntry, "kind" | "startDate" | "endDate" | "daysOfWeek" | "exceptions">,
  date: string,
): boolean => {
  if (date < entry.startDate || date > entry.endDate || entry.exceptions.includes(date)) return false;
  return entry.kind === "one_off" ? date === entry.startDate : entry.daysOfWeek.includes(weekday(date));
};

const partsAt = (instant: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}T${read("hour")}:${read("minute")}`;
};

/** Resolve local wall-clock time to the earliest matching UTC instant, or `undefined` for a DST gap. */
export const resolveLocalInstant = (date: string, time: string, timeZone: string): Date | undefined => {
  const [year, month, day] = dateParts(date);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const center = Date.UTC(year, month - 1, day, hour, minute);
  const expected = `${date}T${time}`;
  let earliest: Date | undefined;
  // Current IANA offsets use 15-minute increments; checking those avoids a full
  // minute-by-minute scan for every expanded occurrence.
  for (let offsetMinutes = -14 * 60; offsetMinutes <= 14 * 60; offsetMinutes += 15) {
    const candidate = new Date(center + offsetMinutes * 60_000);
    if (partsAt(candidate, timeZone) === expected && (!earliest || candidate < earliest)) earliest = candidate;
  }
  return earliest;
};

/** Validate recurrence, ranges, local times, and DST behavior for a Timetable entry. */
export const validateTimetableEntry = (
  input: Pick<CreateTimetableEntry, "kind" | "startDate" | "endDate" | "daysOfWeek" | "startTime" | "endTime">,
  timeZone: string,
): ReadonlyArray<TimetableFieldError> => {
  const errors: Array<TimetableFieldError> = [];
  const uniqueDays = new Set(input.daysOfWeek);
  if (uniqueDays.size !== input.daysOfWeek.length) errors.push({ field: "daysOfWeek", message: "Choose each weekday only once" });
  if (input.startDate > input.endDate) errors.push({ field: "endDate", message: "End date must be on or after start date" });
  if (input.startTime >= input.endTime) errors.push({ field: "endTime", message: "End time must be after start time" });
  if (input.kind === "one_off" && (input.startDate !== input.endDate || input.daysOfWeek.length > 0)) {
    errors.push({ field: "kind", message: "A one-off entry must use one date and no weekdays" });
  }
  if (input.kind === "weekly" && input.daysOfWeek.length === 0) errors.push({ field: "daysOfWeek", message: "Choose at least one weekday" });
  if (errors.length > 0) return errors;

  for (let date = input.startDate; date <= input.endDate; date = nextDate(date)) {
    const matches = input.kind === "one_off" ? date === input.startDate : input.daysOfWeek.includes(weekday(date));
    if (!matches) continue;
    if (!resolveLocalInstant(date, input.startTime, timeZone)) errors.push({ field: "startTime", message: `${input.startTime} does not exist on ${date} in ${timeZone}` });
    if (!resolveLocalInstant(date, input.endTime, timeZone)) errors.push({ field: "endTime", message: `${input.endTime} does not exist on ${date} in ${timeZone}` });
    if (errors.length > 0) break;
  }
  return errors;
};

/** Expand one entry into occurrences within an inclusive local-date range. */
export const expandOccurrences = (
  entry: Pick<TimetableEntry, "kind" | "startDate" | "endDate" | "daysOfWeek" | "exceptions" | "startTime" | "endTime">,
  from: string,
  to: string,
  timeZone: string,
): ReadonlyArray<TimetableOccurrence> => {
  const occurrences: Array<TimetableOccurrence> = [];
  const first = from > entry.startDate ? from : entry.startDate;
  const last = to < entry.endDate ? to : entry.endDate;
  for (let date = first; date <= last; date = nextDate(date)) {
    if (!occursOn(entry, date)) continue;
    const start = resolveLocalInstant(date, entry.startTime, timeZone);
    const end = resolveLocalInstant(date, entry.endTime, timeZone);
    if (start && end) occurrences.push({ date, startTime: entry.startTime, endTime: entry.endTime, startInstant: start.toISOString(), endInstant: end.toISOString() });
  }
  return occurrences;
};
