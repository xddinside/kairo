# Production academic-route contract

Status: implementation-ready decision artifact for production v1

Scope: `/tasks`, `/tasks/:taskId`, `/timetable`, `/timetable/:entryId`,
`/notes`, and `/notes/:noteId`, plus deadline inference for Canvas.

This contract resolves the route behavior left open by
[Specify production Tasks, Timetable, Deadlines, and Notes behavior](https://github.com/xddinside/kairo/issues/7).
It does not add production route code. The current stable routes are still
placeholders; the current seeded components are visual references only.

## Fixed inputs

- `CONTEXT.md` is the vocabulary source. Use `User`, `Course`, `Task`,
  `Assessment`, `Deadline`, `Timetable entry`, and `Note` as defined there.
- [`production-v1-decisions.md`](./production-v1-decisions.md) requires real
  user-owned persistence, typed URL search, explicit ISO dates, stable order,
  cursor pagination, a seven-day workload default, Quiet Rail, and usable
  desktop and mobile routes.
- [`canvas-contracts.md`](./canvas-contracts.md) requires one server-authorized
  Domain command per mutation, optimistic versions, idempotency, safe Undo,
  owner checks, and live shared data. The stable routes and Canvas use the same
  services.
- Issue 4 fixes the domain entities and says that Deadlines are a derived view,
  Tasks and Assessments do not recur, and Timetable entries use the User's
  local timezone.
- Issue 8 chooses Clerk, Neon Postgres, Drizzle, Effect services, and a
  server-only TanStack Start boundary. Issue 15 keeps Drizzle as the only
  schema and migration authority and Effect as the application model.
- Issue 10 settles Quiet Rail and leaves routine responsive route details to
  implementation. `/canvas/today` and the current `/proto/*` routes remain
  prototype-only.

The current `package.json` contains TanStack Start/Router, React, Kumo,
JSON Render, Zod, and no database, Clerk, Effect, or test-runner dependency.
The existing route files for these paths render `RoutePlaceholder`; the
production implementation must add the settled dependencies and server
modules before replacing those placeholders. JSON Render and the seeded
`src/components/proto/*` data stay outside this contract's trust path.

## Decision summary

1. Collection routes own list and create flows. Detail routes own read, edit,
   status, and delete flows. Creation opens a route-local dialog or sheet; it
   does not add an unapproved `/new` route.
2. Every mutation is a typed command with a server-generated command id,
   client idempotency key, and expected record version. A stale version never
   overwrites current data.
3. Deletes hide a record at once, retain a tombstone for 30 days, and expose a
   one-use Undo token for 30 seconds. A purge job removes expired tombstones.
   Account and File deletion rules remain those owned by their own contracts.
4. A dated Task or Assessment may contribute to deadline context for Canvas.
   Deadline remains a derived projection, never a record or an untyped
   `deadlineId` mutation target, and has no stable route.
5. Timetable entries store local wall-clock values and a date range. Weekly
   entries expand into occurrences for a requested range. Skipping one
   occurrence adds an exception; editing one occurrence is out of scope.
6. Notes use explicit Save. The editor does not autosave. Rendered Markdown is
   sanitized and never treated as trusted HTML.
7. TanStack Router `validateSearch` uses Effect Schema's Standard Schema adapter
   when the pinned Effect setup is installed. Malformed search values fall back
   to safe defaults and are canonicalized; they do not take down a route.

## Shared types

The following are code shapes, not a second schema authority. Define them once
in Kairo-owned domain modules with Effect Schema and derive TypeScript types
from those schemas. Server DTOs omit `ownerId`, provider data, and internal
audit fields.

```ts
type IsoDate = string       // YYYY-MM-DD, Gregorian calendar date
type LocalTime = string     // HH:mm, 24-hour local wall-clock time
type Instant = string       // RFC 3339 UTC instant
type RecordVersion = number // positive integer, incremented on every write
type PageSize = 10 | 25 | 50 | 100
type AcademicStatus = "open" | "completed" | "cancelled"

type Task = {
  id: TaskId
  title: string
  details: string | null
  courseId: CourseId | null
  assessmentId: AssessmentId | null
  dueDate: IsoDate | null
  dueTime: LocalTime | null
  status: AcademicStatus
  version: RecordVersion
  createdAt: Instant
  updatedAt: Instant
}

type Assessment = {
  id: AssessmentId
  title: string
  details: string | null
  courseId: CourseId | null
  dueDate: IsoDate | null
  dueTime: LocalTime | null
  status: AcademicStatus
  version: RecordVersion
  createdAt: Instant
  updatedAt: Instant
}

type TimetableEntry = {
  id: TimetableEntryId
  title: string
  details: string | null
  courseId: CourseId | null
  kind: "one_off" | "weekly"
  startDate: IsoDate
  endDate: IsoDate
  daysOfWeek: ReadonlyArray<0 | 1 | 2 | 3 | 4 | 5 | 6>
  startTime: LocalTime
  endTime: LocalTime
  exceptions: ReadonlyArray<IsoDate>
  version: RecordVersion
  createdAt: Instant
  updatedAt: Instant
}

type Note = {
  id: NoteId
  title: string
  bodyMarkdown: string
  courseId: CourseId | null
  version: RecordVersion
  createdAt: Instant
  updatedAt: Instant
}
```

`ownerId`, `deletedAt`, `purgeAfter`, idempotency rows, and audit metadata are
server/database fields. The User record supplies one IANA `timeZone` used for
all date-based academic data. A route never trusts a browser-supplied owner or
timezone. Focus timestamps remain UTC instants as required by the domain model.

### Input envelopes

All create and update inputs include a client-generated idempotency key. The
server creates the command id. `undefined` in a patch means “leave unchanged”;
`null` clears an optional relation or date.

```ts
type CreateTask = {
  title: string
  details?: string | null
  courseId?: CourseId | null
  assessmentId?: AssessmentId | null
  dueDate?: IsoDate | null
  dueTime?: LocalTime | null
  idempotencyKey: string
}

type UpdateTask = {
  taskId: TaskId
  expectedVersion: RecordVersion
  patch: Partial<Omit<CreateTask, "idempotencyKey">>
  idempotencyKey: string
}

type SetAcademicStatus = {
  record: { kind: "task" | "assessment"; id: string }
  expectedVersion: RecordVersion
  status: AcademicStatus
  idempotencyKey: string
}

type CreateAssessment = Omit<CreateTask, "assessmentId">

type UpdateAssessment = {
  assessmentId: AssessmentId
  expectedVersion: RecordVersion
  patch: Partial<Omit<CreateAssessment, "idempotencyKey">>
  idempotencyKey: string
}

type CreateTimetableEntry = {
  title: string
  details?: string | null
  courseId?: CourseId | null
  kind: "one_off" | "weekly"
  startDate: IsoDate
  endDate: IsoDate
  daysOfWeek: ReadonlyArray<0 | 1 | 2 | 3 | 4 | 5 | 6>
  startTime: LocalTime
  endTime: LocalTime
  idempotencyKey: string
}

type UpdateTimetableEntry = {
  entryId: TimetableEntryId
  expectedVersion: RecordVersion
  patch: Partial<Omit<CreateTimetableEntry, "idempotencyKey">>
  idempotencyKey: string
}

type SkipTimetableOccurrence = {
  entryId: TimetableEntryId
  occurrenceDate: IsoDate
  expectedVersion: RecordVersion
  idempotencyKey: string
}

type CreateNote = {
  title: string
  bodyMarkdown?: string
  courseId?: CourseId | null
  idempotencyKey: string
}

type UpdateNote = {
  noteId: NoteId
  expectedVersion: RecordVersion
  patch: { title?: string; bodyMarkdown?: string; courseId?: CourseId | null }
  idempotencyKey: string
}
```

There is no bulk write input. A status change is its own command, so a list
toggle cannot silently change a second record.

## Validation rules

Decode browser, URL, provider, and database values at their boundary. Use
Effect Schema branded ids and refinements for shape; use the domain service for
ownership and cross-record rules.

### Text and ids

- Trim titles and reject empty values. Task and Assessment titles are 1–200
  Unicode scalar values; Timetable titles are 1–160; Note titles are 1–160.
- Task and Assessment details are optional and capped at 5,000 characters.
- Note Markdown is allowed to be empty while drafting and is capped at 200,000
  UTF-8 bytes. Normalize line endings to LF before saving.
- Reject malformed ids, unknown enum values, duplicate array members, and
  client-supplied owner, version, created time, or deleted time.
- Store server-generated ids as UUIDs. The exact UUID version is an
  implementation choice; the id must not be predictable from a route search
  value.

### Dates, times, and relations

- Dates must be exact `YYYY-MM-DD` values. Times must be exact `HH:mm` values.
- A `dueTime` requires `dueDate`. A due date may be in the past; an open record
  then appears as overdue. Editing a completed or cancelled record does not
  silently reopen it.
- Task `courseId` and `assessmentId`, Assessment `courseId`, Timetable
  `courseId`, and Note `courseId` must reference a current Course owned by the
  User. A foreign or missing relation returns `not_found` without revealing
  which condition occurred.
- A Task may link to one Assessment. The Assessment and Task must share the
  same User. Deleting an Assessment with linked Tasks returns
  `has_dependents`; it never detaches or deletes those Tasks implicitly.
- For a one-off Timetable entry, `startDate === endDate`, `daysOfWeek` and
  `exceptions` are empty. For a weekly entry, `startDate <= endDate`, at least
  one weekday is present, and every exception is inside the range and matches
  one selected weekday.
- `startTime < endTime`. A local-time value in a timezone transition gap is
  rejected with a field error. An ambiguous repeated hour resolves to the
  earlier occurrence. Tests must cover the User's actual IANA timezone and a
  DST timezone.
- Overlapping Timetable occurrences are valid records. The service returns a
  typed `overlapWarning` with the owned conflicting entries; it never moves or
  deletes either entry. The UI shows a text conflict marker, not color alone.

### Status transitions

Create defaults to `open`. The service permits `open -> completed`,
`open -> cancelled`, and either terminal state back to `open`. A direct
`completed <-> cancelled` change is rejected; reopen first. Status is not
accepted in a general edit patch.

### Markdown rendering

Render Note Markdown through one server/client-safe renderer. Raw HTML is
escaped or removed, links allow only `https` and `mailto` (and ordinary
relative note-safe links if later added), and no script, iframe, style, or
event-handler attribute is emitted. The saved Markdown remains the source for
export; rendered HTML is never persisted as the note body.

## Service and persistence boundary

Route files should contain search decoding, loader/action wiring, and view
composition. They must not import Drizzle, Clerk internals, storage clients, or
the model provider.

```text
TanStack Start route loader/action
  -> Clerk verified UserContext
  -> Effect Schema decode (URL/input/output)
  -> TaskService / AssessmentService / TimetableService / NoteService
  -> DeadlineQuery (read-only union over Task + Assessment)
  -> Database service (Drizzle queries + one transaction + RLS context)
  -> Neon pooled Postgres
```

Kairo should provide these Effect services:

- `TaskService`: list, get, create, update, setStatus, delete.
- `AssessmentService`: get, create, update, setStatus, delete. It has no
  stable Assessment route in v1 and remains available to typed Canvas actions.
- `TimetableService`: list entries with expanded occurrences, get, create,
  update, skipOccurrence, delete.
- `NoteService`: list, get, create, update, delete.
- `DeadlineQuery`: one read-only snapshot query over dated Tasks and
  Assessments. It returns a discriminated `kind` and never creates a Deadline
  row.
- `CourseLookup`: owner-scoped options for route forms. It may return only
  current Courses and must not become a second Course authority.
- `DomainCommandStore`: idempotency result, command audit, expected-version
  check, and command result. It is shared with Canvas actions.
- `UndoService`: server-held inverse, one-use token, expiry, ownership, and
  expected-version check. It is shared with Canvas Undo.
- `UserContext`: verified Clerk id and User timezone. The browser never
  supplies either as authority.

Drizzle owns tables, SQL queries, constraints, and checked-in migrations. The
Effect `Database` layer owns request context, transaction scope, typed row
decoding, retry classification, and mapping database errors to domain errors.
Each transaction sets the verified Clerk id as transaction-local RLS context;
the application query also includes owner scope. Test cross-user denial at both
layers.

### Tables and invariants

The exact Drizzle names may vary, but the migration must provide:

- `tasks`: owner, title, details, course, optional assessment, due date/time,
  status, version, timestamps, tombstone fields, and a same-owner foreign-key
  check for linked records.
- `assessments`: the matching fields without a recurrence relation.
- `timetable_entries`: owner, title, details, course, kind, date range, local
  times, version, timestamps, and tombstone fields.
- `timetable_entry_exceptions`: entry id plus occurrence date, unique per entry;
  deleting an entry removes its exceptions in the same transaction.
- `notes`: owner, title, Markdown body, optional course, version, timestamps,
  and tombstone fields.
- `domain_commands`: owner, idempotency key, command kind, target, result,
  created time, and a uniqueness constraint on `(owner_id, idempotency_key)`.
- `undo_tokens`: owner, command id, encrypted inverse or inverse reference,
  expiry, consumed time, and the version expected for a safe inverse.

Every private table has an `owner_id` policy. A list query excludes tombstones;
a detail lookup treats a tombstoned, foreign, or unknown id as the same
`not_found` result. Hard purge is a scheduled, idempotent job after 30 days.
Account deletion bypasses this grace period and follows the account lifecycle
contract.

## Commands, conflicts, deletion, Undo, and recovery

### Command result

All route mutations return one of these typed outcomes:

```ts
type CommandResult<T> =
  | { _tag: "applied"; value: T; undoToken?: string }
  | { _tag: "already_applied"; value: T; undoToken?: string }
  | { _tag: "conflict"; reason: "stale_version" | "has_dependents"; current?: T }
  | { _tag: "not_found" }
  | { _tag: "invalid"; fields: ReadonlyArray<FieldError> }
  | { _tag: "unavailable"; retryable: boolean; requestId: string }
```

The server checks the idempotency key before doing work. A repeated key returns
the first result, even after a lost browser response. A new key with a stale
version returns `conflict`; it does not retry with the newer version.

### Update and status conflicts

Forms load `version`. Update and status commands include that version. A
successful write increments it atomically. On conflict, keep the user's local
edits, show current server values, and offer `Reload` or `Copy my changes` into
the refreshed form. Never merge fields silently. A list command conflict
leaves the row unchanged and refetches only that row or the current page.

### Delete and Undo

- Delete always asks for confirmation and names the record. It marks the row
  deleted in the same transaction, removes it from all route queries, and
  invalidates live Canvas references. It does not cascade from an Assessment to
  linked Tasks.
- The delete result includes an Undo token valid for 30 seconds. Undo restores
  the row only when its version is still the deleted version. A later edit,
  relation change, or purge returns `conflict` and leaves data unchanged.
- Create, edit, status changes, timetable occurrence skips, and deletes return
  Undo when their inverse is safe. Undo is a new command with its own
  idempotency key; it is not a client-side snapshot restore.
- Notes and task details may contain private data. Store inverse data only in
  the private, owner-scoped command store, encrypt it where the chosen database
  setup requires, and expire it with the token. Do not log it.
- The toast has a text action for Undo and a screen-reader status announcement.
  If the token is expired or the inverse is unsafe, say so and offer reload;
  never pretend the operation was reversed.

### Recovery

- A first-load read failure shows a route error with Retry. It does not render
  seeded fallback data.
- A mutation timeout or lost response is retried with the same idempotency key.
  If the service is unavailable, keep the last loaded data and the form's
  unsaved values. Do not submit a new command automatically.
- On a successful command followed by a failed list revalidation, show the
  command result and mark the list stale. Retry revalidation with the same
  query; do not duplicate the command.
- Database/network errors map to `unavailable` and a request id. Validation,
  ownership, dependency, and version errors are not retried as infrastructure
  failures.
- Recovery metadata contains ids, operation kind, request id, and safe error
  codes only. Do not expose SQL, stack traces, Clerk claims, Note Markdown, or
  provider/model data.

## URL search, ordering, and pagination

TanStack Router validates each route's query object. Use Effect Schema's
Standard Schema adapter, as supported by TanStack Router's search validation
contract. The encoded URL uses short scalar values; the decoded type below is
what loaders and components receive.

### Shared query rules

- `q` is optional, trimmed, Unicode-normalized, and limited to 100 characters.
  Search is case-insensitive. Bind it as a value; never concatenate it into
  SQL. A blank value is omitted.
- `pageSize` defaults to 25 and accepts only 10, 25, 50, or 100. The service
  returns `items`, `nextCursor`, and `hasNext`; it does not promise a total
  count.
- `cursor` is opaque, signed or authenticated by the server, short-lived, and
  bound to User, route, search filters, and ordering. It carries the last sort
  key plus id. An invalid or expired cursor resets to the first page and emits
  a non-blocking `search.invalid_cursor` status.
- Every query has a final unique id tie-breaker. Inserts or edits between page
  requests cannot create duplicate rows in a page traversal. Changing any
  filter, sort, date range, or page size clears the cursor.
- Unknown query keys are ignored. Invalid enum, date, id, boolean, or page-size
  values use the route default and are replaced in the URL. A range with
  `from > to` resets to the route's default range. The parser must never throw
  for hand-edited URLs.
- Default ranges are resolved in the User's timezone. Timetable and Deadlines
  use the next seven local dates, inclusive. The route may replace an omitted
  range with explicit `from` and `to` ISO values after load so a copied URL is
  repeatable. Tasks are an inventory and default to all open Tasks; a
  seven-day Task window is available through `window=next7`.
- Search updates use `replace` navigation for typing and `push` navigation for
  deliberate sort/date changes. The browser Back button returns to the prior
  result state, not a new server command.

### Tasks

Decoded search:

```ts
type TaskSearch = {
  q: string
  status: AcademicStatus | "all"       // open by default
  courseId: CourseId | null
  assessment: AssessmentId | "none" | null
  window: "all" | "next7" | "custom" // all by default
  from: IsoDate | null
  to: IsoDate | null
  sort: "due_asc" | "updated_desc" | "title_asc" // due_asc by default
  pageSize: PageSize
  cursor: string | null
}
```

`window=next7` means due dates from today through today plus six days and does
not include undated Tasks. V1 does not hide undated Tasks in the default `all`
view. `window=custom` requires both `from` and `to`. Default `due_asc` orders
dated rows by due date, timed rows before untimed rows on the same date, then
title using a stable case-folded collation, then id. Undated rows are last.
`updated_desc` and `title_asc` use the same id tie-breaker.

The list response includes course and assessment display names as read-only
joins. It never embeds a foreign record that the User cannot read.

### Timetable

Decoded search:

```ts
type TimetableSearch = {
  q: string
  courseId: CourseId | null
  from: IsoDate       // next seven local dates by default
  to: IsoDate
  pageSize: PageSize
  cursor: string | null
}
```

The service pages parent entries ordered by the first upcoming occurrence in
the requested range, start time, title, and entry id. Each item includes its
matching `occurrences` in date order. Paging counts parent entries, not
expanded occurrences, so a recurring entry never consumes a variable number of
cursor rows. An exception removes that date from `occurrences`.

### Deadlines

Decoded search:

```ts
type DeadlineSearch = {
  q: string
  kind: "all" | "task" | "assessment" // all by default
  status: AcademicStatus | "all"   // open by default
  courseId: CourseId | null
  from: IsoDate                    // today by default
  to: IsoDate                      // today + 6 by default
  includeOverdue: boolean          // true by default
  pageSize: PageSize
  cursor: string | null
}
```

The one SQL snapshot unions dated Tasks and dated Assessments, filters each by
the same User and status, and returns:

```ts
type DeadlineRow = {
  kind: "task" | "assessment"
  id: TaskId | AssessmentId
  title: string
  courseId: CourseId | null
  dueDate: IsoDate
  dueTime: LocalTime | null
  status: AcademicStatus
  version: RecordVersion
  linkedAssessmentId?: AssessmentId // present only for a Task
}
```

Open overdue rows before `from` appear first when `includeOverdue` is true.
Rows then sort by due date, timed before untimed, kind (`task` before
`assessment`), title, and id. Completed and cancelled rows are not shown by
the default `open` filter. There is no `deadlineId` command, table, or detail
route.

### Notes

Decoded search:

```ts
type NoteSearch = {
  q: string
  courseId: CourseId | "none" | null
  sort: "updated_desc" | "created_desc" | "title_asc"
  pageSize: PageSize
  cursor: string | null
}
```

`updated_desc` is the default. Search checks title and Markdown body with an
escaped, case-folded term. The list returns a short plain-text preview made by
the server; it does not return rendered HTML or the full body for every row.

Detail route search is only UI state:

```ts
type NoteDetailSearch = { mode: "view" | "edit" } // view by default
```

The same `mode` shape may be used for Task, Timetable, and assessment editing
where it improves reload behavior. It must not change authorization or record
selection.

## Route workflows

### `/tasks` and `/tasks/:taskId`

Collection loader:

1. Authenticate and decode `TaskSearch`.
2. Query the User's non-deleted Tasks with the filters and stable cursor.
3. Load only the Course and Assessment labels needed for this page.
4. Render list, result status, filter controls, and Create Task.

Create Task opens a route-local form with title, details, Course, Assessment,
due date, and optional local time. It submits `CreateTask`, defaults status to
open, returns the created row and Undo token, and navigates to
`/tasks/:taskId` after the command commits. The prior list URL stays in browser
history for Back.

Detail loader reads one owner-scoped Task by path id. Unknown and foreign ids
use the same not-found boundary. The detail view supports:

- edit fields through `UpdateTask` with the loaded version;
- complete, reopen, or cancel through `SetAcademicStatus`;
- delete through the confirmed `deleteTask` command;
- links to the Course, Assessment, and related Deadline filter when present.

After a successful edit or status change, stay on the detail route, update the
record, and show Undo. After delete, navigate back to the prior Task search or
the default `/tasks` list. If a Task is linked to an Assessment, deleting it
does not delete the Assessment. A Task with a past due date is still editable
and shows overdue as a derived label.

### `/timetable` and `/timetable/:entryId`

Collection loader uses the requested seven-day range and returns parent entries
with expanded occurrences. Create offers One-off and Weekly. The form shows
date range, weekday selection, start/end local time, optional Course, and
details. The server validates the recurrence shape and returns overlap warnings
without silently changing the entry.

Detail supports editing the whole entry, skipping one occurrence, and deleting
the whole entry. `SkipTimetableOccurrence` is only offered for a date that the
entry would produce and adds one exception. There is no edit-one-occurrence
operation. To record a changed single date, create a one-off entry and skip the
original occurrence.

Deleting a recurring entry removes all future and past occurrences represented
by that entry. The command remains Undoable during the token window. A deleted
entry disappears from the requested range immediately. A stale version or
invalid exception returns a field or conflict error without changing the
series.

### Deadline inference

Deadline has no stable route. Canvas executes `DeadlineQuery` against one
database snapshot when a request needs date pressure, overdue work, or
preparation context. The query returns discriminated Task and Assessment rows;
the model explains which source facts shaped its conclusion instead of
presenting a separately managed Deadline record.

Generated actions target the canonical Task or Assessment through its typed
service. The server reloads that source before acting, applies ownership and
version checks, and refuses to delete an Assessment while any Task links to it.
Canvas never turns the derived projection into a generic `deadlineId` command.

### `/notes` and `/notes/:noteId`

Collection loader returns title, Course label, updated time, and a plain-text
preview. Create opens a title/body/Course form. On success, navigate to the
new Note detail in view mode and show Undo.

Detail view renders sanitized Markdown and offers Edit. Edit mode keeps the raw
Markdown in a controlled form and may show a local preview. Save sends the
whole new body with the loaded version; there is no autosave or background
write. Cancel discards only unsaved local changes. A dirty form warns before
route navigation or reload where the browser permits it.

Delete requires confirmation, hides the Note immediately, and returns to the
prior list search. Restore is available only through the 30-second Undo token;
the Note route never exposes the tombstone.

## Shared route states

- **Loading:** skeleton rows use the final list shape. The shell, heading, and
  existing URL remain visible. A mutation disables only its affected control.
- **Empty:** no records shows a Create action. A filtered empty result says the
  filters found no records and offers Clear filters. Do not show seeded examples.
- **Not found:** the same page is used for missing and foreign detail ids.
- **Validation:** field errors stay next to the field and a summary receives
  focus on submit when needed. The server remains the authority.
- **Conflict:** preserve local input, show current server values, and offer
  Reload. Do not overwrite local input or retry with a new version.
- **Recovery:** a retryable service failure retains the last usable data and
  uses the same idempotency key for a pending mutation. A first-load failure
  has Retry and no fake content.
- **Success:** use an in-app toast with a text action where an Undo token exists.
  Announce status changes without moving focus from the completed control.

## Desktop and mobile rules

The route content sits inside the existing Quiet Rail shell.

### Desktop (`md` and wider)

- Keep the labelled rail persistent. The active stable route has
  `aria-current="page"`; navigation does not depend on hover or icon meaning.
- Collection pages use a wide list/table with a toolbar, result status, and a
  visible Create button. Detail pages use a readable main column and a
  side-by-side metadata/action area where space allows.
- Tasks show title, Course, due date/time, status, and row actions. Timetable
  shows a seven-day agenda or grouped list. Deadlines group by date. Notes use
  a list with the selected detail view or an explicit detail route.
- Filters remain visible when they fit. Create and filter forms use a dialog
  rather than changing the route tree.

### Mobile (below `md`)

- Replace the rail with a labelled top bar and a menu sheet containing all
  stable routes. The current route and a visible Menu button remain available
  at all scroll positions. Selecting a route closes the sheet.
- Lists use stacked cards or an agenda, never a horizontally scrolling table
  for the core fields. The first action is reachable without hover. Row actions
  use a labelled menu or a full-width action sheet.
- Filters open in a sheet with Apply and Clear. Applying filters resets the
  cursor and closes the sheet. The result count/status remains in the page.
- Create and edit forms use a full-height sheet or page with a sticky action
  row. The primary action stays reachable above the on-screen keyboard.
- Timetable is a chronological agenda. Deadlines remain grouped by local date.
  Notes open detail as a full-screen route with a visible Back control. Task
  and Timetable details do the same when a list was the entry point.
- All controls have at least a 44 by 44 CSS pixel target, visible focus, and a
  text label or accessible name. No required workflow depends on a swipe,
  drag, hover, or precise pointer position.

The route state is server-backed on both form factors. Local component state
may hold an unsaved form or open sheet; it is not the source of records.

## Accessibility contract

- Use one `h1` per route, semantic `main`, labelled navigation, lists for
  lists, and a real table only where the desktop table remains understandable
  on narrow widths. Group date headings with `section` labels.
- Every input has a visible label. `aria-invalid` and `aria-describedby` point
  to text errors. A summary lists the first failed field and focuses it after a
  failed submit; do not rely on color or native browser wording alone.
- Status, overdue, overlap, save, delete, and Undo feedback includes text and
  uses an appropriate polite live region. Loading and result-count updates do
  not steal focus.
- Dialogs and sheets have an accessible name, `aria-modal` when modal, focus
  moved inside on open, a visible close/cancel control, Escape support, a
  trapped tab sequence, and focus returned to the invoking control. Delete
  confirmation uses an alert dialog only when it needs immediate attention.
- Icon-only buttons expose a specific accessible name, such as “Undo delete
  task” or “Open task actions”. Decorative icons are hidden from assistive
  technology. Active route and selected note use programmatic state, not only
  styling.
- Dates and times use `<time>` with machine-readable values where available.
  Local timezone and recurrence text are visible. A timetable overlap is
  announced as text and is not encoded only by red/amber color.
- Markdown links and headings preserve a logical heading order. Rendered
  content has keyboard-accessible links and no focusable injected HTML.
- Support keyboard navigation, visible `:focus-visible`, zoom to 200%, reduced
  motion, high contrast, and touch. Do not use an auto-advancing editor or a
  timeout that removes an error before it can be read.

These rules follow the WAI-ARIA modal dialog pattern and WCAG error and status
message guidance. See the sources below.

## Acceptance scenarios

1. An authenticated student creates a Task from `/tasks`; one owned row is
   stored, the URL opens its detail route, and a repeat with the same key does
   not create a second row.
2. A Task edit with the current version saves, increments `version`, updates
   the list and Canvas live reference, and returns an Undo token.
3. A stale Task edit preserves the form, returns `conflict`, shows current
   data, and never overwrites the newer edit.
4. Completing a Task, using Undo, and reloading leaves exactly the prior status.
5. Deleting a Task hides it from list, deadline, and Canvas live-reference
   queries; Undo restores it only within the token and version window.
6. A foreign or unknown Task id returns the same not-found route state.
7. A weekly Timetable entry expands only matching dates in a seven-day range;
   skipping one date adds an exception and leaves other dates visible.
8. A Timetable entry with an overlapping occurrence saves with a typed warning;
   it does not silently alter the other entry. An invalid DST-gap time fails
   validation.
9. `DeadlineQuery` returns dated Tasks and Assessments from one snapshot, puts
   overdue open rows before the requested range, and never persists a Deadline
   record. Canvas can explain which source rows informed its response.
10. A typed Assessment action returns `has_dependents` without changing data
    when a linked Task prevents deletion.
11. A Note saves raw Markdown, renders safe output, strips unsafe HTML, and
    exports the original Markdown rather than rendered markup.
12. A stale Note save leaves local edits intact and offers reload. A lost save
    response repeated with the same key returns the original result.
13. Moving from page one to the next cursor page while another record is
    inserted produces no duplicate or skipped row under the route's ordering.
14. Changing search or date filters clears the cursor and produces a shareable
    URL with typed, explicit dates where the route uses a workload range.
15. Each workflow works by keyboard and on a mobile viewport: menu, filters,
    create/edit sheet, validation, delete confirmation, Undo, and Back all keep
    focus and expose status text.

## Focused test plan

The checkout has no test runner yet. Add the Vite-compatible test runner and
React test utilities during route implementation; keep database tests against
a disposable Neon branch or a Postgres test instance, not a browser mock.

### Schema and service tests

- Effect Schema accepts canonical ids, dates, local times, enum values, and
  query defaults; rejects empty titles, invalid ranges, invalid recurrence,
  oversized details/Markdown, due time without a date, duplicate weekdays, and
  unsafe ids.
- Task and Assessment services enforce owner scope, same-owner relations,
  status transitions, dependent Assessment deletion, version checks, and
  idempotency.
- Timetable service expands one-off and weekly entries, applies exceptions,
  handles local timezone and DST, returns overlap warnings, and rejects an
  exception outside its recurrence.
- DeadlineQuery returns the correct discriminated union, default seven-day
  range, overdue behavior, stable ties, and no Deadline writes.
- Note service normalizes line endings, preserves raw Markdown, enforces size,
  and produces safe preview input.
- Undo tests cover create, edit, status, skip, and delete; expired, reused,
  stale, foreign, and post-purge tokens fail without changing data.
- Cross-user tests run at service and PostgreSQL RLS layers. Unknown and
  foreign ids have identical result tags and response shapes.

### Route and component tests

- Each `validateSearch` parses URL strings into the documented typed input,
  falls back for malformed values, canonicalizes defaults, and resets cursors
  after a filter change.
- Loader fixtures cover loading, empty, filtered-empty, not-found, conflict,
  unavailable, and stale-revalidation states without seeded production data.
- Form tests cover field association, error focus, dirty Note navigation, local
  Markdown preview, delete confirmation, Undo toast, and idempotent retry.
- Deadline tests verify Task links use `/tasks/:taskId` and Assessment rows use
  typed route-local commands; no generic deadline mutation is sent.
- Timetable tests verify parent-entry pagination and occurrence expansion do
  not duplicate a recurring entry across cursors.
- Keyboard tests cover route menu, filters, dialogs/sheets, Escape, focus
  return, status announcements, and reduced-motion behavior.

### End-to-end scenarios

Run a small browser suite at desktop and mobile widths for acceptance scenarios
1, 3, 5, 7, 9, 10, 11, 12, and 15. Assert the URL, visible text, network
command key, and final persisted row. Use a test User and never the developer's
account. The later production-quality issue owns browser matrix, performance,
and release gates.

## Assumptions, rejected options, and remaining inputs

### Assumptions

- The User record gains an IANA timezone before these routes ship. This route
  contract does not invent timezone settings UI.
- A Course lookup service exists even though Courses are outside this ticket.
  It returns only owned current Courses and handles a deleted Course without
  exposing it.
- A 30-day tombstone and 30-second Undo window are safe technical defaults.
  The later retention decision may change purge timing without changing route
  behavior or Undo semantics.
- Explicit Save for Notes is safer than autosave while version conflicts and
  private Markdown recovery are being built. Autosave can be added as a new
  command contract later.
- Assessment route-local editing is acceptable because issue 4 explicitly
  excludes an Assessment detail route.

### Rejected options

- A separate Deadline table or id would duplicate source data and make stale
  Task/Assessment changes hard to reconcile.
- Offset/page-number pagination would move rows under concurrent writes and
  cannot provide the stable traversal required by the product decision.
- Local storage, seeded fixtures, or client-only writes would violate the
  production destination and the Canvas shared-data contract.
- A generic `updateDeadline` command would hide whether a Task or Assessment
  was changed and weaken authorization.
- Editing a single occurrence inside a recurring Timetable entry would require
  an override model not present in the settled domain. Use an exception plus a
  one-off entry instead.
- Immediate hard deletion would make safe Undo impossible. Tombstones keep
  deletion immediate in route reads while allowing a bounded inverse.
- Note autosave would create hidden commands and frequent version conflicts.
  Explicit Save makes the write visible and retryable.

### Remaining integration inputs

No product conflict was found in the fixed records. Implementation still needs
the Course service contract, the User timezone field supplied by account work,
and the retention/purge schedule from the production-quality decision. None
changes the four route workflows above.

## Sources

Repository decisions:

- [`CONTEXT.md`](../../CONTEXT.md)
- [`production-v1-decisions.md`](./production-v1-decisions.md)
- [`canvas-contracts.md`](./canvas-contracts.md)
- [Define Kairo production domain model and route contracts](https://github.com/xddinside/kairo/issues/4)
- [Choose Kairo production data and deployment foundation](https://github.com/xddinside/kairo/issues/8)
- [Choose Kairo's idiomatic Effect v4 architecture](https://github.com/xddinside/kairo/issues/15)
- [Prototype Kairo production shell and mobile Canvas navigation](https://github.com/xddinside/kairo/issues/10)

Primary technical sources:

- [TanStack Router search parameters](https://tanstack.com/router/latest/docs/guide/search-params)
  documents typed `validateSearch`, loader search dependencies, URL updates,
  and resilient fallback values for malformed query input.
- [Effect Schema introduction](https://www.effect.website/docs/schema/introduction)
  documents decoding, encoding, and Standard Schema generation. Kairo uses the
  pinned v4 beta API and the exact package policy recorded in issue 15.
- [WAI-ARIA modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
  defines focus placement, focus containment, Escape, accessible naming, and
  `aria-modal` behavior.
- [WCAG 2.2 error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification)
  requires errors to identify the affected input and describe the problem.
- [WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  covers announcing non-focus-stealing save, loading, result, and error status.
