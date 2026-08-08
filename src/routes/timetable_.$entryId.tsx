import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import {
  ArrowLeft,
  CalendarBlank,
  Clock,
  PencilSimple,
  Prohibit,
  Repeat,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { startTransition, useState, type ComponentType, type ReactNode } from "react";
import { z } from "zod";

import {
  formatCompactDay,
  formatDuration,
  formatFullDate,
  formatRangeLabel,
  formatTime,
  formatWeekdayList,
} from "../components/timetable/timetable-dates";
import { TimetableError, TimetableLoading, TimetableToast } from "../components/timetable/timetable-feedback";
import { TimetableForm, type TimetableFormValues } from "../components/timetable/timetable-form";
import { TimetableShell } from "../components/timetable/timetable-shell";
import { useLocalClock } from "../components/timetable/use-local-clock";
import { requireAuthenticatedRoute } from "../server/auth/functions";
import type { TimetableCommandResult, TimetableFieldError } from "../server/timetable/domain";
import {
  deleteTimetableEntry,
  getTimetableEntry,
  skipTimetableOccurrence,
  undoTimetableCommand,
  updateTimetableEntry,
} from "../server/timetable/functions";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const detailSearch = z.object({
  from: z.string().regex(isoDate).optional().catch(undefined),
  to: z.string().regex(isoDate).optional().catch(undefined),
});

export const Route = createFileRoute("/timetable_/$entryId")({
  beforeLoad: requireAuthenticatedRoute,
  validateSearch: detailSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const from = deps.from ?? "1970-01-01";
    const to = deps.to ?? "2100-12-31";
    const entry = await getTimetableEntry({ data: { entryId: params.entryId, from, to } });
    if (!entry) throw notFound();
    return entry;
  },
  pendingComponent: () => <TimetableLoading title="entry" />,
  errorComponent: ({ reset }) => <TimetableError title="Entry unavailable" reset={reset} />,
  component: TimetableDetailRoute,
  notFoundComponent: () => (
    <TimetableShell>
      <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:px-10">
        <div className="flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-kumo-tint text-kumo-subtle ring ring-kumo-line">
            <CalendarBlank aria-hidden="true" size={23} />
          </span>
          <div className="mt-5">
            <Text as="h1" variant="heading2">
              Entry not found
            </Text>
          </div>
          <Link
            to="/timetable"
            className="mt-6 flex min-h-10 items-center gap-2 rounded-lg bg-kumo-base px-4 text-base font-medium text-kumo-strong shadow-sm ring ring-kumo-line hover:bg-kumo-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus"
          >
            <ArrowLeft aria-hidden="true" size={15} weight="bold" />
            Back to timetable
          </Link>
        </div>
      </main>
    </TimetableShell>
  ),
});

function TimetableDetailRoute() {
  const entry = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const clock = useLocalClock();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<ReadonlyArray<TimetableFieldError>>([]);
  const [notice, setNotice] = useState<{ readonly message: string; readonly token?: string }>();

  const refresh = () => startTransition(() => void router.invalidate());
  const handle = (result: TimetableCommandResult, success: string) => {
    if (result._tag === "invalid") {
      setErrors(result.fields);
      return false;
    }
    if (result._tag !== "applied" && result._tag !== "already_applied") {
      setErrors([
        {
          field: "form",
          message:
            result._tag === "conflict"
              ? "This entry changed. Reload before trying again."
              : "The entry is no longer available.",
        },
      ]);
      return false;
    }
    setNotice({
      message:
        result.overlapWarnings.length > 0
          ? `${success} ${result.overlapWarnings.length} overlap warning${result.overlapWarnings.length === 1 ? "" : "s"}.`
          : success,
      ...(result.undoToken ? { token: result.undoToken } : {}),
    });
    refresh();
    return true;
  };

  const update = async (values: TimetableFormValues) => {
    setPending(true);
    setErrors([]);
    try {
      const result = await updateTimetableEntry({
        data: { entryId: entry.id, expectedVersion: entry.version, ...values, idempotencyKey: crypto.randomUUID() },
      });
      if (handle(result, "Entry updated.")) setEditOpen(false);
    } finally {
      setPending(false);
    }
  };

  const skip = async (date: string) => {
    setPending(true);
    try {
      const result = await skipTimetableOccurrence({
        data: {
          entryId: entry.id,
          occurrenceDate: date,
          expectedVersion: entry.version,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      handle(result, "Occurrence skipped.");
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    setPending(true);
    try {
      const result = await deleteTimetableEntry({
        data: { entryId: entry.id, expectedVersion: entry.version, idempotencyKey: crypto.randomUUID() },
      });
      if (result._tag === "applied" || result._tag === "already_applied") {
        setDeleteOpen(false);
        await navigate({ to: "/timetable", search });
        return;
      }
      handle(result, "Entry deleted.");
    } finally {
      setPending(false);
    }
  };

  const undo = async () => {
    if (!notice?.token) return;
    const result = await undoTimetableCommand({
      data: { token: notice.token, idempotencyKey: crypto.randomUUID() },
    });
    setNotice({
      message: result._tag === "applied" ? "Change undone." : "This change can no longer be undone.",
    });
    if (result._tag === "applied") refresh();
  };

  const weekly = entry.kind === "weekly";
  const duration = formatDuration(entry.startTime, entry.endTime);
  const weekdayList = formatWeekdayList(entry.daysOfWeek);

  return (
    <TimetableShell>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 pb-24 sm:px-6 md:py-12 lg:px-10">
        <Link
          to="/timetable"
          search={search}
          className="group flex min-h-9 w-fit items-center gap-2 rounded-lg text-base font-medium text-kumo-subtle hover:text-kumo-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus"
        >
          <ArrowLeft
            aria-hidden="true"
            size={15}
            weight="bold"
            className="transition-transform duration-150 ease-out group-hover:-translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none"
          />
          Back to timetable
        </Link>

        <header className="mt-4 flex flex-wrap items-start justify-between gap-x-5 gap-y-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <Text as="h1" variant="heading1" truncate>
                {entry.title}
              </Text>
              <Badge variant={weekly ? "info" : "secondary"}>{weekly ? "Weekly" : "One-off"}</Badge>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-kumo-subtle">
              <span className="tabular-nums">
                {formatTime(entry.startTime)} – {formatTime(entry.endTime)}
              </span>
              {duration ? (
                <>
                  <span aria-hidden="true" className="h-3 w-px bg-kumo-line" />
                  <span className="tabular-nums">{duration}</span>
                </>
              ) : null}
              {entry.courseTitle ? (
                <>
                  <span aria-hidden="true" className="h-3 w-px bg-kumo-line" />
                  <span className="truncate">{entry.courseTitle}</span>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="secondary"
              icon={<PencilSimple aria-hidden="true" size={15} />}
              onClick={() => setEditOpen(true)}
              className="min-h-10 transition-transform duration-150 ease-out active:scale-[0.96]"
            >
              Edit
            </Button>
            <Button
              variant="secondary-destructive"
              icon={<Trash aria-hidden="true" size={15} />}
              onClick={() => setDeleteOpen(true)}
              className="min-h-10 transition-transform duration-150 ease-out active:scale-[0.96]"
            >
              Delete
            </Button>
          </div>
        </header>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid gap-8">
            <section aria-labelledby="schedule-heading">
              <div className="mb-2.5 px-0.5">
                <Text as="h2" variant="heading3" id="schedule-heading">
                  Schedule
                </Text>
              </div>
              <LayerCard>
                <dl className="divide-y divide-kumo-line">
                  <DetailRow icon={Clock} term="Time">
                    <span className="tabular-nums">
                      {formatTime(entry.startTime)} – {formatTime(entry.endTime)}
                    </span>
                  </DetailRow>
                  <DetailRow icon={Repeat} term="Repeats">
                    {weekly && weekdayList ? `Every ${weekdayList}` : "Once"}
                  </DetailRow>
                  <DetailRow icon={CalendarBlank} term="Range">
                    <span className="tabular-nums">
                      {weekly ? formatRangeLabel(entry.startDate, entry.endDate) : formatFullDate(entry.startDate)}
                    </span>
                  </DetailRow>
                  {entry.exceptions.length > 0 ? (
                    <DetailRow icon={Prohibit} term="Skipped">
                      <span className="tabular-nums">
                        {entry.exceptions.length} {entry.exceptions.length === 1 ? "occurrence" : "occurrences"}
                      </span>
                    </DetailRow>
                  ) : null}
                </dl>
              </LayerCard>
            </section>

            {entry.details ? (
              <section aria-labelledby="details-heading">
                <div className="mb-2.5 px-0.5">
                  <Text as="h2" variant="heading3" id="details-heading">
                    Details
                  </Text>
                </div>
                <LayerCard className="px-5 py-4">
                  <p className="text-base leading-relaxed whitespace-pre-wrap text-kumo-default">{entry.details}</p>
                </LayerCard>
              </section>
            ) : null}
          </div>

          <section aria-labelledby="occurrences-heading">
            <div className="mb-2.5 flex items-baseline justify-between gap-3 px-0.5">
              <Text as="h2" variant="heading3" id="occurrences-heading">
                Occurrences
              </Text>
              <span className="text-xs text-kumo-subtle tabular-nums">{entry.occurrences.length}</span>
            </div>
            <LayerCard>
              {entry.occurrences.length === 0 ? (
                <p className="px-5 py-10 text-center text-base text-kumo-subtle">No occurrences in this range.</p>
              ) : (
                <ol className="max-h-100 divide-y divide-kumo-line overflow-y-auto">
                  {entry.occurrences.map((occurrence) => {
                    const past = Boolean(clock && occurrence.endInstant <= clock.instant);
                    return (
                      <li
                        key={occurrence.date}
                        className="flex items-center justify-between gap-3 px-4 py-2 ps-3.5"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span
                            aria-hidden="true"
                            className={`size-1.5 shrink-0 rounded-full ${past ? "bg-kumo-fill" : "bg-kumo-brand"}`}
                          />
                          <time
                            dateTime={occurrence.date}
                            className={`truncate text-base tabular-nums ${past ? "text-kumo-subtle" : "font-medium text-kumo-strong"}`}
                          >
                            {formatCompactDay(occurrence.date)}
                          </time>
                        </span>
                        {weekly ? (
                          <Button
                            variant="ghost"
                            disabled={pending}
                            onClick={() => void skip(occurrence.date)}
                            aria-label={`Skip ${formatCompactDay(occurrence.date)}`}
                            className="h-8 shrink-0 rounded-lg px-2.5 text-kumo-subtle transition-transform duration-150 ease-out active:scale-[0.96]"
                          >
                            Skip
                          </Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              )}
            </LayerCard>
          </section>
        </div>

        <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
          <Dialog className="max-h-[calc(100svh-2rem)] overflow-y-auto p-5 sm:max-w-2xl sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <Dialog.Title className="text-xl font-semibold">Edit entry</Dialog.Title>
              <Dialog.Close
                aria-label="Close edit entry"
                render={(props) => (
                  <Button
                    {...props}
                    title="Close edit entry"
                    variant="secondary"
                    shape="square"
                    className="min-h-10 min-w-10"
                    icon={<X aria-hidden="true" size={18} />}
                  />
                )}
              />
            </div>
            <TimetableForm
              entry={entry}
              initialDate={entry.startDate}
              errors={errors}
              pending={pending}
              onCancel={() => setEditOpen(false)}
              onSubmit={update}
            />
          </Dialog>
        </Dialog.Root>

        <Dialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
          <Dialog className="p-5 sm:max-w-md sm:p-6">
            <span className="flex size-11 items-center justify-center rounded-xl bg-kumo-danger-tint text-kumo-danger">
              <WarningCircle aria-hidden="true" size={22} />
            </span>
            <Dialog.Title className="mt-4 text-xl font-semibold">Delete {entry.title}?</Dialog.Title>
            <Dialog.Description className="mt-2 text-base text-kumo-subtle">
              This removes the entry and every occurrence it generates.
            </Dialog.Description>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setDeleteOpen(false)}
                className="min-h-10 transition-transform duration-150 ease-out active:scale-[0.96]"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() => void remove()}
                className="min-h-10 shadow-sm transition-transform duration-150 ease-out active:scale-[0.96]"
              >
                {pending ? "Deleting…" : "Delete entry"}
              </Button>
            </div>
          </Dialog>
        </Dialog.Root>
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

function DetailRow({
  icon: Icon,
  term,
  children,
}: {
  readonly icon: ComponentType<{ readonly size?: number; readonly "aria-hidden"?: boolean }>;
  readonly term: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-3.5">
      <span className="h-lh flex shrink-0 items-center text-kumo-subtle">
        <Icon aria-hidden size={16} />
      </span>
      <dt className="w-20 shrink-0 text-base text-kumo-subtle">{term}</dt>
      <dd className="min-w-0 flex-1 text-base font-medium text-kumo-strong">{children}</dd>
    </div>
  );
}
