import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { ArrowLeft, Trash, WarningCircle, X } from "@phosphor-icons/react";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { startTransition, useState } from "react";
import { z } from "zod";

import { TimetableForm, type TimetableFormValues } from "../components/timetable/timetable-form";
import { TimetableShell } from "../components/timetable/timetable-shell";
import { requireAuthenticatedRoute } from "../server/auth/functions";
import { deleteTimetableEntry, getTimetableEntry, skipTimetableOccurrence, undoTimetableCommand, updateTimetableEntry } from "../server/timetable/functions";
import type { TimetableCommandResult, TimetableFieldError } from "../server/timetable/domain";

const detailSearch = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined) });

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
  component: TimetableDetailRoute,
  notFoundComponent: () => <TimetableShell><main className="mx-auto max-w-3xl px-4 py-12"><h1 className="text-2xl font-semibold">Entry not found</h1><Link to="/timetable" className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-kumo-brand">Back to timetable</Link></main></TimetableShell>,
});

function TimetableDetailRoute() {
  const entry = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<ReadonlyArray<TimetableFieldError>>([]);
  const [notice, setNotice] = useState<{ readonly message: string; readonly token?: string }>();
  const refresh = () => startTransition(() => void router.invalidate());
  const handle = (result: TimetableCommandResult, success: string) => {
    if (result._tag === "invalid") { setErrors(result.fields); return false; }
    if (result._tag !== "applied" && result._tag !== "already_applied") { setErrors([{ field: "form", message: result._tag === "conflict" ? "This entry changed. Reload before trying again." : "The entry is no longer available." }]); return false; }
    setNotice({ message: result.overlapWarnings.length > 0 ? `${success} ${result.overlapWarnings.length} overlap warning${result.overlapWarnings.length === 1 ? "" : "s"}.` : success, token: result.undoToken });
    refresh(); return true;
  };
  const update = async (values: TimetableFormValues) => { setPending(true); setErrors([]); try { if (handle(await updateTimetableEntry({ data: { entryId: entry.id, expectedVersion: entry.version, ...values, idempotencyKey: crypto.randomUUID() } }), "Entry updated.")) setEditOpen(false); } finally { setPending(false); } };
  const skip = async (date: string) => { setPending(true); try { handle(await skipTimetableOccurrence({ data: { entryId: entry.id, occurrenceDate: date, expectedVersion: entry.version, idempotencyKey: crypto.randomUUID() } }), "Occurrence skipped."); } finally { setPending(false); } };
  const remove = async () => { setPending(true); try { const result = await deleteTimetableEntry({ data: { entryId: entry.id, expectedVersion: entry.version, idempotencyKey: crypto.randomUUID() } }); if (result._tag === "applied" || result._tag === "already_applied") { setDeleteOpen(false); await navigate({ to: "/timetable", search }); } else handle(result, "Entry deleted."); } finally { setPending(false); } };
  const undo = async () => { if (!notice?.token) return; const result = await undoTimetableCommand({ data: { token: notice.token, idempotencyKey: crypto.randomUUID() } }); setNotice({ message: result._tag === "applied" ? "Change undone." : "This change can no longer be undone." }); if (result._tag === "applied") refresh(); };

  return <TimetableShell><main className="mx-auto max-w-4xl px-4 py-6 pb-24 sm:px-6 md:py-8 lg:px-10">
    <Link to="/timetable" search={search} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-kumo-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus"><ArrowLeft aria-hidden="true" size={16} />Back to timetable</Link>
    <div className="mt-4 flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold text-kumo-strong">{entry.title}</h1><Badge variant="secondary">{entry.kind === "weekly" ? "Weekly" : "One-off"}</Badge></div>{entry.courseTitle ? <p className="mt-1 text-sm text-kumo-subtle">{entry.courseTitle}</p> : null}</div><div className="flex gap-2"><Button variant="secondary" onClick={() => setEditOpen(true)}>Edit</Button><Button variant="secondary" icon={<Trash aria-hidden="true" size={16} />} onClick={() => setDeleteOpen(true)}>Delete</Button></div></div>
    <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <LayerCard className="px-5 py-5"><h2 className="text-base font-semibold">Schedule</h2><dl className="mt-4 grid gap-4 text-sm"><div><dt className="text-kumo-subtle">Time</dt><dd className="mt-1 font-medium">{entry.startTime} - {entry.endTime}</dd></div><div><dt className="text-kumo-subtle">Range</dt><dd className="mt-1 font-medium">{entry.startDate} - {entry.endDate}</dd></div>{entry.details ? <div><dt className="text-kumo-subtle">Details</dt><dd className="mt-1 whitespace-pre-wrap">{entry.details}</dd></div> : null}</dl></LayerCard>
      <section aria-labelledby="occurrences-heading"><h2 id="occurrences-heading" className="text-base font-semibold">Occurrences</h2>{entry.occurrences.length === 0 ? <p className="mt-3 text-sm text-kumo-subtle">No occurrences in this range.</p> : <ol className="mt-3 grid gap-2">{entry.occurrences.map((occurrence) => <li key={occurrence.date} className="rounded-lg bg-kumo-base px-4 py-3 ring ring-kumo-line"><time dateTime={occurrence.date} className="text-sm font-medium">{occurrence.date}</time>{entry.kind === "weekly" ? <Button variant="secondary" className="mt-3 w-full" disabled={pending} onClick={() => void skip(occurrence.date)}>Skip occurrence</Button> : null}</li>)}</ol>}</section>
    </div>
    <Dialog.Root open={editOpen} onOpenChange={setEditOpen}><Dialog className="max-h-[calc(100svh-2rem)] overflow-y-auto p-5 sm:max-w-2xl sm:p-6"><div className="mb-5 flex items-center justify-between"><Dialog.Title className="text-xl font-semibold">Edit entry</Dialog.Title><Dialog.Close aria-label="Close edit entry" render={(props) => <Button {...props} title="Close edit entry" variant="secondary" shape="square" icon={<X aria-hidden="true" size={18} />} />} /></div><TimetableForm entry={entry} initialDate={entry.startDate} errors={errors} pending={pending} onCancel={() => setEditOpen(false)} onSubmit={update} /></Dialog></Dialog.Root>
    <Dialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}><Dialog className="p-5 sm:max-w-md sm:p-6"><WarningCircle aria-hidden="true" size={24} className="text-kumo-danger" /><Dialog.Title className="mt-3 text-xl font-semibold">Delete {entry.title}?</Dialog.Title><Dialog.Description className="mt-2 text-sm text-kumo-subtle">This removes the whole entry and every occurrence it represents.</Dialog.Description><div className="mt-6 flex justify-end gap-2"><Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button disabled={pending} onClick={() => void remove()}>Delete entry</Button></div></Dialog></Dialog.Root>
  </main>{notice ? <div role="status" className="fixed right-4 bottom-4 z-50 flex max-w-sm items-center gap-3 rounded-lg bg-kumo-strong px-4 py-3 text-sm text-kumo-inverse shadow-lg"><span>{notice.message}</span>{notice.token ? <button type="button" onClick={() => void undo()} className="min-h-11 font-medium underline underline-offset-4">Undo</button> : null}</div> : null}</TimetableShell>;
}
