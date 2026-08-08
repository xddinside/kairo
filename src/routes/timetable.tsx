import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { CalendarDots, CaretLeft, CaretRight, Plus, WarningCircle, X } from "@phosphor-icons/react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { startTransition, useState } from "react";
import { z } from "zod";

import { TimetableForm, type TimetableFormValues } from "../components/timetable/timetable-form";
import { TimetableShell } from "../components/timetable/timetable-shell";
import { requireAuthenticatedRoute } from "../server/auth/functions";
import { createTimetableEntry, listTimetable, undoTimetableCommand } from "../server/timetable/functions";
import { nextDate, type TimetableCommandResult, type TimetableFieldError } from "../server/timetable/domain";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const searchSchema = z.object({
  from: z.string().regex(isoDate).optional().catch(undefined),
  to: z.string().regex(isoDate).optional().catch(undefined),
  q: z.string().max(100).optional().catch(undefined),
  courseId: z.string().uuid().optional().catch(undefined),
  pageSize: z.coerce.number().pipe(z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)])).optional().catch(25),
});

const localDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const plusDays = (date: string, days: number): string => {
  let value = date;
  for (let index = 0; index < Math.abs(days); index += 1) {
    if (days > 0) value = nextDate(value);
    else {
      const parsed = new Date(`${value}T12:00:00Z`);
      parsed.setUTCDate(parsed.getUTCDate() - 1);
      value = parsed.toISOString().slice(0, 10);
    }
  }
  return value;
};

export const Route = createFileRoute("/timetable")({
  beforeLoad: requireAuthenticatedRoute,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => {
    const from = deps.from ?? localDate(new Date());
    const to = deps.to && deps.to >= from ? deps.to : plusDays(from, 6);
    return listTimetable({ data: { from, to, q: deps.q?.trim() ?? "", courseId: deps.courseId ?? null, pageSize: deps.pageSize ?? 25 } });
  },
  pendingComponent: TimetableLoading,
  errorComponent: TimetableError,
  component: TimetableRoute,
});

function TimetableRoute() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<ReadonlyArray<TimetableFieldError>>([]);
  const [notice, setNotice] = useState<{ readonly message: string; readonly token?: string }>();
  const from = search.from ?? localDate(new Date());
  const to = search.to && search.to >= from ? search.to : plusDays(from, 6);
  const grouped = new Map<string, Array<{ entry: (typeof data.items)[number]; occurrence: (typeof data.items)[number]["occurrences"][number] }>>();
  for (const entry of data.items) for (const occurrence of entry.occurrences) grouped.set(occurrence.date, [...(grouped.get(occurrence.date) ?? []), { entry, occurrence }]);

  const moveRange = (days: number) => navigate({ search: (previous) => ({ ...previous, from: plusDays(from, days), to: plusDays(to, days) }) });
  const submitCreate = async (values: TimetableFormValues) => {
    setPending(true);
    setErrors([]);
    try {
      const result = await createTimetableEntry({ data: { ...values, idempotencyKey: crypto.randomUUID() } });
      if (result._tag === "invalid") { setErrors(result.fields); return; }
      if (result._tag !== "applied" && result._tag !== "already_applied") { setErrors([{ field: "form", message: result._tag === "conflict" ? "The entry changed. Reload and try again." : "The entry could not be saved." }]); return; }
      setCreateOpen(false);
      setNotice({ message: result.overlapWarnings.length > 0 ? `Entry created with ${result.overlapWarnings.length} overlap warning${result.overlapWarnings.length === 1 ? "" : "s"}.` : "Entry created.", token: result.undoToken });
      startTransition(() => void router.invalidate());
    } finally { setPending(false); }
  };
  const undo = async () => {
    if (!notice?.token) return;
    const result: TimetableCommandResult = await undoTimetableCommand({ data: { token: notice.token, idempotencyKey: crypto.randomUUID() } });
    setNotice({ message: result._tag === "applied" ? "Change undone." : "This change can no longer be undone." });
    if (result._tag === "applied") startTransition(() => void router.invalidate());
  };

  return (
    <TimetableShell>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-24 sm:px-6 md:py-8 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="text-2xl font-semibold text-kumo-strong">Timetable</h1><p className="mt-1 text-sm text-kumo-subtle">{formatRange(from, to)} · {data.timeZone}</p></div>
          <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
            <Dialog.Trigger render={(props) => <Button {...props} icon={<Plus aria-hidden="true" size={16} weight="bold" />} className="active:scale-[0.96] transition-transform">Create entry</Button>} />
            <Dialog className="max-h-[calc(100svh-2rem)] overflow-y-auto p-5 sm:max-w-2xl sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-4"><Dialog.Title className="text-xl font-semibold">Create entry</Dialog.Title><Dialog.Close aria-label="Close create entry" render={(props) => <Button {...props} title="Close create entry" variant="secondary" shape="square" icon={<X aria-hidden="true" size={18} />} />} /></div>
              <TimetableForm initialDate={from} errors={errors} pending={pending} onCancel={() => setCreateOpen(false)} onSubmit={submitCreate} />
            </Dialog>
          </Dialog.Root>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 border-y border-kumo-line py-3">
          <Button variant="secondary" shape="square" aria-label="Previous seven days" icon={<CaretLeft aria-hidden="true" size={17} />} onClick={() => void moveRange(-7)} />
          <Button variant="secondary" onClick={() => void navigate({ search: { from: localDate(new Date()), to: plusDays(localDate(new Date()), 6), pageSize: search.pageSize } })}>Today</Button>
          <Button variant="secondary" shape="square" aria-label="Next seven days" icon={<CaretRight aria-hidden="true" size={17} />} onClick={() => void moveRange(7)} />
        </div>

        {grouped.size === 0 ? (
          <LayerCard className="mt-6 px-6 py-10 text-center"><CalendarDots aria-hidden="true" size={28} className="mx-auto text-kumo-subtle" /><h2 className="mt-3 text-lg font-semibold">No entries this week</h2><Button className="mt-5 active:scale-[0.96] transition-transform" onClick={() => setCreateOpen(true)}>Create entry</Button></LayerCard>
        ) : (
          <div className="mt-6 grid gap-7">
            {[...grouped].map(([date, rows]) => (
              <section key={date} aria-labelledby={`date-${date}`}>
                <div className="mb-3 flex items-baseline justify-between gap-3"><h2 id={`date-${date}`} className="text-base font-semibold">{formatDay(date)}</h2><span className="text-xs text-kumo-subtle tabular-nums">{rows.length} {rows.length === 1 ? "entry" : "entries"}</span></div>
                <LayerCard><ol className="divide-y divide-kumo-line">{rows.sort((left, right) => left.occurrence.startTime.localeCompare(right.occurrence.startTime)).map(({ entry, occurrence }) => (
                  <li key={`${entry.id}-${date}`} className="grid gap-3 px-4 py-4 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center sm:px-5">
                    <p className="text-sm font-medium tabular-nums"><time dateTime={occurrence.startInstant}>{formatTime(occurrence.startTime)}</time><span className="mx-1 text-kumo-subtle">-</span><time dateTime={occurrence.endInstant}>{formatTime(occurrence.endTime)}</time></p>
                    <div className="min-w-0"><Link to="/timetable/$entryId" params={{ entryId: entry.id }} search={{ from, to }} className="text-sm font-medium text-kumo-strong underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus">{entry.title}</Link><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-kumo-subtle">{entry.courseTitle ? <span>{entry.courseTitle}</span> : null}<Badge variant="secondary">{entry.kind === "weekly" ? "Weekly" : "One-off"}</Badge></div></div>
                    <Link to="/timetable/$entryId" params={{ entryId: entry.id }} search={{ from, to }} className="flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-kumo-brand ring ring-kumo-line hover:bg-kumo-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus">View</Link>
                  </li>
                ))}</ol></LayerCard>
              </section>
            ))}
          </div>
        )}
      </main>
      {notice ? <div role="status" className="fixed right-4 bottom-4 z-50 flex max-w-sm items-center gap-3 rounded-lg bg-kumo-strong px-4 py-3 text-sm text-kumo-inverse shadow-lg"><span>{notice.message}</span>{notice.token ? <button type="button" onClick={() => void undo()} className="min-h-11 font-medium underline underline-offset-4">Undo</button> : null}</div> : null}
    </TimetableShell>
  );
}

function TimetableLoading() { return <TimetableShell><main className="mx-auto max-w-5xl px-4 py-8"><h1 className="text-2xl font-semibold">Timetable</h1><div aria-label="Loading timetable" className="mt-8 grid gap-4">{[0, 1, 2].map((value) => <div key={value} className="h-24 animate-pulse rounded-lg bg-kumo-tint motion-reduce:animate-none" />)}</div></main></TimetableShell>; }
function TimetableError({ reset }: { readonly reset: () => void }) { return <TimetableShell><main className="mx-auto max-w-3xl px-4 py-12"><WarningCircle aria-hidden="true" size={28} className="text-kumo-danger" /><h1 className="mt-3 text-2xl font-semibold">Timetable unavailable</h1><Button className="mt-5" onClick={reset}>Retry</Button></main></TimetableShell>; }
function formatDay(value: string) { return new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)); }
function formatRange(from: string, to: string) { return `${new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${from}T12:00:00Z`))} - ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${to}T12:00:00Z`))}`; }
function formatTime(value: string) { const [hour = 0, minute = 0] = value.split(":").map(Number); return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(2000, 0, 1, hour, minute))); }
