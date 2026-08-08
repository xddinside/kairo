import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Empty } from "@cloudflare/kumo/components/empty";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { CalendarDots, CalendarPlus, CaretLeft, CaretRight, Plus, Repeat, X } from "@phosphor-icons/react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { startTransition, useState } from "react";
import { z } from "zod";

import {
  datesBetween,
  formatDayLabel,
  formatDayNumber,
  formatDuration,
  formatRangeLabel,
  formatTime,
  formatWeekdayShort,
  localDate,
  shiftDate,
} from "../components/timetable/timetable-dates";
import { TimetableError, TimetableLoading, TimetableToast } from "../components/timetable/timetable-feedback";
import { TimetableForm, type TimetableFormValues } from "../components/timetable/timetable-form";
import { TimetableShell } from "../components/timetable/timetable-shell";
import { useLocalClock } from "../components/timetable/use-local-clock";
import { requireAuthenticatedRoute } from "../server/auth/functions";
import type {
  TimetableCommandResult,
  TimetableEntry,
  TimetableFieldError,
  TimetableOccurrence,
} from "../server/timetable/domain";
import { createTimetableEntry, listTimetable, undoTimetableCommand } from "../server/timetable/functions";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const searchSchema = z.object({
  from: z.string().regex(isoDate).optional().catch(undefined),
  to: z.string().regex(isoDate).optional().catch(undefined),
  q: z.string().max(100).optional().catch(undefined),
  courseId: z.string().uuid().optional().catch(undefined),
  pageSize: z.coerce
    .number()
    .pipe(z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]))
    .optional()
    .catch(25),
});

/** One rendered session: the owning entry plus the occurrence being shown. */
interface AgendaItem {
  readonly entry: TimetableEntry;
  readonly occurrence: TimetableOccurrence;
}

const agendaKey = (item: AgendaItem): string => `${item.entry.id}-${item.occurrence.date}`;

export const Route = createFileRoute("/timetable")({
  beforeLoad: requireAuthenticatedRoute,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => {
    const from = deps.from ?? localDate(new Date());
    const to = deps.to && deps.to >= from ? deps.to : shiftDate(from, 6);
    return listTimetable({
      data: {
        from,
        to,
        q: deps.q?.trim() ?? "",
        courseId: deps.courseId ?? null,
        pageSize: deps.pageSize ?? 25,
      },
    });
  },
  pendingComponent: () => <TimetableLoading title="Timetable" />,
  errorComponent: ({ reset }) => <TimetableError title="Timetable unavailable" reset={reset} />,
  component: TimetableRoute,
});

function TimetableRoute() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const clock = useLocalClock();
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<ReadonlyArray<TimetableFieldError>>([]);
  const [notice, setNotice] = useState<{ readonly message: string; readonly token?: string }>();

  const from = search.from ?? localDate(new Date());
  const to = search.to && search.to >= from ? search.to : shiftDate(from, 6);

  const byDate = new Map<string, Array<AgendaItem>>();
  for (const entry of data.items) {
    for (const occurrence of entry.occurrences) {
      const bucket = byDate.get(occurrence.date);
      if (bucket) bucket.push({ entry, occurrence });
      else byDate.set(occurrence.date, [{ entry, occurrence }]);
    }
  }
  for (const bucket of byDate.values()) {
    bucket.sort(
      (left, right) =>
        left.occurrence.startTime.localeCompare(right.occurrence.startTime) ||
        left.entry.title.localeCompare(right.entry.title),
    );
  }

  const week = datesBetween(from, to).map((date) => ({ date, items: byDate.get(date) ?? [] }));
  const days = week.filter((day) => day.items.length > 0);
  const sessionCount = days.reduce((total, day) => total + day.items.length, 0);
  const upcoming = clock
    ? days.flatMap((day) => day.items).find((item) => item.occurrence.startInstant > clock.instant)
    : undefined;
  const nextKey = upcoming ? agendaKey(upcoming) : undefined;
  const showsToday = Boolean(clock && clock.today >= from && clock.today <= to);

  const moveRange = (offset: number) =>
    void navigate({
      search: (previous) => ({ ...previous, from: shiftDate(from, offset), to: shiftDate(to, offset) }),
    });
  const goToday = () => {
    const start = localDate(new Date());
    void navigate({ search: (previous) => ({ ...previous, from: start, to: shiftDate(start, 6) }) });
  };

  const submitCreate = async (values: TimetableFormValues) => {
    setPending(true);
    setErrors([]);
    try {
      const result = await createTimetableEntry({ data: { ...values, idempotencyKey: crypto.randomUUID() } });
      if (result._tag === "invalid") {
        setErrors(result.fields);
        return;
      }
      if (result._tag !== "applied" && result._tag !== "already_applied") {
        setErrors([
          {
            field: "form",
            message:
              result._tag === "conflict"
                ? "The entry changed. Reload and try again."
                : "The entry could not be saved.",
          },
        ]);
        return;
      }
      setCreateOpen(false);
      setNotice({
        message:
          result.overlapWarnings.length > 0
            ? `Entry created with ${result.overlapWarnings.length} overlap warning${result.overlapWarnings.length === 1 ? "" : "s"}.`
            : "Entry created.",
        ...(result.undoToken ? { token: result.undoToken } : {}),
      });
      startTransition(() => void router.invalidate());
    } finally {
      setPending(false);
    }
  };

  const undo = async () => {
    if (!notice?.token) return;
    const result: TimetableCommandResult = await undoTimetableCommand({
      data: { token: notice.token, idempotencyKey: crypto.randomUUID() },
    });
    setNotice({
      message: result._tag === "applied" ? "Change undone." : "This change can no longer be undone.",
    });
    if (result._tag === "applied") startTransition(() => void router.invalidate());
  };

  return (
    <TimetableShell>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 pb-24 sm:px-6 md:py-12 lg:px-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-kumo-base text-kumo-brand shadow-sm ring ring-kumo-line">
              <CalendarDots aria-hidden="true" size={21} />
            </span>
            <div className="min-w-0">
              <Text as="h1" variant="heading1">
                Timetable
              </Text>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-kumo-subtle">
                <span className="tabular-nums">
                  {sessionCount} {sessionCount === 1 ? "session" : "sessions"}
                </span>
                <span aria-hidden="true" className="h-3 w-px bg-kumo-line" />
                <span className="truncate">{data.timeZone}</span>
              </p>
            </div>
          </div>
          <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
            <Dialog.Trigger
              render={(props) => (
                <Button
                  {...props}
                  variant="primary"
                  icon={<Plus aria-hidden="true" size={16} weight="bold" />}
                  className="min-h-10 shrink-0 rounded-lg shadow-sm transition-transform duration-150 ease-out active:scale-[0.96]"
                >
                  Create entry
                </Button>
              )}
            />
            <Dialog className="max-h-[calc(100svh-2rem)] overflow-y-auto p-5 sm:max-w-2xl sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <Dialog.Title className="text-xl font-semibold">Create entry</Dialog.Title>
                <Dialog.Close
                  aria-label="Close create entry"
                  render={(props) => (
                    <Button
                      {...props}
                      title="Close create entry"
                      variant="secondary"
                      shape="square"
                      className="min-h-10 min-w-10"
                      icon={<X aria-hidden="true" size={18} />}
                    />
                  )}
                />
              </div>
              <TimetableForm
                initialDate={from}
                errors={errors}
                pending={pending}
                onCancel={() => setCreateOpen(false)}
                onSubmit={submitCreate}
              />
            </Dialog>
          </Dialog.Root>
        </header>

        <nav aria-label="Timetable range" className="mt-8">
          <LayerCard>
            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
              <div className="flex items-center gap-1 rounded-xl bg-kumo-tint p-1 ring ring-kumo-line">
                <Button
                  variant="ghost"
                  shape="square"
                  aria-label="Previous seven days"
                  icon={<CaretLeft aria-hidden="true" size={16} weight="bold" />}
                  onClick={() => moveRange(-7)}
                  className="size-9 rounded-lg transition-transform duration-150 ease-out hover:bg-kumo-base active:scale-[0.96]"
                />
                <Button
                  variant="ghost"
                  onClick={goToday}
                  className="h-9 rounded-lg px-3 font-medium transition-transform duration-150 ease-out hover:bg-kumo-base active:scale-[0.96]"
                >
                  Today
                </Button>
                <Button
                  variant="ghost"
                  shape="square"
                  aria-label="Next seven days"
                  icon={<CaretRight aria-hidden="true" size={16} weight="bold" />}
                  onClick={() => moveRange(7)}
                  className="size-9 rounded-lg transition-transform duration-150 ease-out hover:bg-kumo-base active:scale-[0.96]"
                />
              </div>
              <p className="pe-1 text-base font-medium text-kumo-strong tabular-nums">{formatRangeLabel(from, to)}</p>
            </div>

            <ol className="grid grid-cols-7 gap-1 border-t border-kumo-line p-1">
              {week.map((day) => (
                <li key={day.date}>
                  <DayChip date={day.date} count={day.items.length} today={clock?.today === day.date} />
                </li>
              ))}
            </ol>
          </LayerCard>
        </nav>

        {days.length === 0 ? (
          <LayerCard className="mt-8">
            <Empty
              size="base"
              icon={
                <span className="flex size-12 items-center justify-center rounded-xl bg-kumo-brand text-kumo-inverse shadow-sm">
                  <CalendarPlus aria-hidden="true" size={23} />
                </span>
              }
              title="Nothing scheduled in this range"
              contents={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    variant="primary"
                    icon={<Plus aria-hidden="true" size={16} weight="bold" />}
                    onClick={() => setCreateOpen(true)}
                    className="shadow-sm transition-transform duration-150 ease-out active:scale-[0.96]"
                  >
                    Create entry
                  </Button>
                  {showsToday ? null : (
                    <Button
                      variant="secondary"
                      onClick={goToday}
                      className="transition-transform duration-150 ease-out active:scale-[0.96]"
                    >
                      Go to today
                    </Button>
                  )}
                </div>
              }
            />
          </LayerCard>
        ) : (
          <div className="mt-8 grid gap-8">
            {days.map((day, index) => (
              <section
                key={day.date}
                id={`day-${day.date}`}
                aria-labelledby={`day-heading-${day.date}`}
                tabIndex={-1}
                className="lfc-rise scroll-mt-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-kumo-focus"
                style={{ animationDelay: `${Math.min(index, 4) * 45}ms` }}
              >
                <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-0.5">
                  <div className="flex items-center gap-2">
                    <Text as="h2" variant="heading3" id={`day-heading-${day.date}`}>
                      {formatDayLabel(day.date)}
                    </Text>
                    {clock?.today === day.date ? <Badge variant="info">Today</Badge> : null}
                  </div>
                  <span className="text-xs text-kumo-subtle tabular-nums">
                    {day.items.length} {day.items.length === 1 ? "session" : "sessions"}
                  </span>
                </div>

                <LayerCard>
                  <ol className="divide-y divide-kumo-line">
                    {day.items.map((item) => (
                      <li key={agendaKey(item)}>
                        <AgendaRow
                          item={item}
                          range={{ from, to }}
                          next={agendaKey(item) === nextKey}
                          past={Boolean(clock && item.occurrence.endInstant <= clock.instant)}
                        />
                      </li>
                    ))}
                  </ol>
                </LayerCard>
              </section>
            ))}
          </div>
        )}
      </main>

      {notice ? (
        <TimetableToast
          message={notice.message}
          {...(notice.token ? { undoToken: notice.token } : {})}
          pending={pending}
          onUndo={() => void undo()}
          onDismiss={() => setNotice(undefined)}
        />
      ) : null}
    </TimetableShell>
  );
}

/** One day in the range strip, showing its session density at a glance. */
function DayChip({
  date,
  count,
  today,
}: {
  readonly date: string;
  readonly count: number;
  readonly today: boolean;
}) {
  const dots = Math.min(count, 3);
  const label = `${formatDayLabel(date)}, ${count} ${count === 1 ? "session" : "sessions"}`;
  const body = (
    <>
      <span className={`text-xs ${count > 0 ? "text-kumo-subtle" : "text-kumo-inactive"}`}>
        {formatWeekdayShort(date)}
      </span>
      <span
        className={`flex size-7 items-center justify-center rounded-full text-base font-medium tabular-nums ${
          today ? "bg-kumo-brand text-white" : count > 0 ? "text-kumo-strong" : "text-kumo-inactive"
        }`}
      >
        {formatDayNumber(date)}
      </span>
      <span aria-hidden="true" className="flex h-1 items-center gap-0.5">
        {Array.from({ length: dots }, (_, index) => (
          <span
            key={index}
            className={`size-1 rounded-full ${today ? "bg-kumo-brand" : "bg-kumo-fill"}`}
          />
        ))}
      </span>
    </>
  );

  if (count === 0) {
    return (
      <div aria-label={label} className="flex flex-col items-center gap-1 rounded-sm px-1 py-2">
        {body}
      </div>
    );
  }

  return (
    <a
      href={`#day-${date}`}
      aria-label={label}
      className="flex flex-col items-center gap-1 rounded-sm px-1 py-2 hover:bg-kumo-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus"
    >
      {body}
    </a>
  );
}

/** One session row on the day timeline. */
function AgendaRow({
  item,
  range,
  next,
  past,
}: {
  readonly item: AgendaItem;
  readonly range: { readonly from: string; readonly to: string };
  readonly next: boolean;
  readonly past: boolean;
}) {
  const { entry, occurrence } = item;
  const duration = formatDuration(occurrence.startTime, occurrence.endTime);

  return (
    <Link
      to="/timetable/$entryId"
      params={{ entryId: entry.id }}
      search={range}
      className="group grid grid-cols-[4.5rem_0.75rem_minmax(0,1fr)_auto] items-stretch gap-x-3 px-4 py-3.5 hover:bg-kumo-tint focus-visible:relative focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-kumo-focus sm:px-5"
    >
      <p className="text-base leading-5 tabular-nums">
        <time
          dateTime={occurrence.startInstant}
          className={past ? "text-kumo-inactive" : "font-medium text-kumo-strong"}
        >
          {formatTime(occurrence.startTime)}
        </time>
        <br />
        <time dateTime={occurrence.endInstant} className={past ? "text-kumo-inactive" : "text-kumo-subtle"}>
          {formatTime(occurrence.endTime)}
        </time>
      </p>

      <span aria-hidden="true" className="relative flex justify-center">
        <span className="absolute -top-3.5 -bottom-3.5 w-px bg-kumo-line" />
        <span
          className={`relative mt-1.5 size-2 rounded-full ring-4 ring-kumo-base group-hover:ring-kumo-tint ${
            next ? "bg-kumo-brand" : past ? "bg-kumo-fill" : "bg-kumo-line"
          }`}
        />
      </span>

      <div className="min-w-0">
        <p
          className={`truncate text-base font-medium underline-offset-4 group-hover:underline ${
            past ? "text-kumo-subtle" : "text-kumo-strong"
          }`}
        >
          {entry.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-kumo-subtle">
          {entry.courseTitle ? (
            <>
              <span className="truncate">{entry.courseTitle}</span>
              <span aria-hidden="true" className="h-3 w-px bg-kumo-line" />
            </>
          ) : null}
          {duration ? <span className="tabular-nums">{duration}</span> : null}
          {entry.kind === "weekly" ? (
            <span className="flex items-center gap-1">
              <span className="h-lh flex items-center">
                <Repeat aria-hidden="true" size={12} />
              </span>
              Weekly
            </span>
          ) : null}
          {next ? (
            <span className="rounded-full bg-kumo-brand/12 px-1.5 py-0.5 font-medium text-kumo-brand">Next</span>
          ) : null}
        </div>
      </div>

      <span className="flex items-center self-center text-kumo-inactive">
        <CaretRight
          aria-hidden="true"
          size={15}
          weight="bold"
          className="transition-transform duration-150 ease-out group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none"
        />
      </span>
    </Link>
  );
}
