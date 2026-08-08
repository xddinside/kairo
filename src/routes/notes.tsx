import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { MagnifyingGlass, NoteBlank, Plus, WarningCircle, X } from "@phosphor-icons/react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { startTransition, useEffect, useState } from "react";
import { z } from "zod";

import { NoteForm, type NoteFormValues } from "../components/notes/note-form";
import { NoteShell } from "../components/notes/note-shell";
import { requireAuthenticatedRoute } from "../server/auth/functions";
import type { NoteFieldError } from "../server/notes/domain";
import { createNote, listNotes, undoNoteCommand } from "../server/notes/functions";

const searchSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  courseId: z.union([z.literal("none"), z.string().uuid()]).optional().catch(undefined),
  sort: z.enum(["updated_desc", "created_desc", "title_asc"]).optional().catch("updated_desc"),
  pageSize: z.coerce.number().pipe(z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)])).optional().catch(25),
  cursor: z.string().max(2048).optional().catch(undefined),
});

export const Route = createFileRoute("/notes")({
  beforeLoad: requireAuthenticatedRoute,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listNotes({ data: { q: deps.q?.trim() ?? "", courseId: deps.courseId ?? null, sort: deps.sort ?? "updated_desc", pageSize: deps.pageSize ?? 25, cursor: deps.cursor ?? null } }),
  pendingComponent: NotesLoading,
  errorComponent: NotesError,
  component: NotesRoute,
});

function NotesRoute() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<ReadonlyArray<NoteFieldError>>([]);
  const [notice, setNotice] = useState<{ readonly message: string; readonly token?: string }>();

  useEffect(() => {
    const stored = sessionStorage.getItem("kairo.note.notice");
    if (!stored) return;
    sessionStorage.removeItem("kairo.note.notice");
    try {
      const value: unknown = JSON.parse(stored);
      if (!value || typeof value !== "object" || !("message" in value) || typeof value.message !== "string") return;
      const token = Reflect.get(value, "token");
      setNotice({ message: value.message, ...(typeof token === "string" ? { token } : {}) });
    } catch {
      // Ignore stale browser-only feedback; authoritative Note data still comes from the loader.
    }
  }, []);

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const q = String(form.get("q") ?? "").trim();
    void navigate({ search: (previous) => ({ ...previous, q: q || undefined, cursor: undefined }), replace: true });
  };

  const create = async (values: NoteFormValues) => {
    setPending(true);
    setErrors([]);
    try {
      const result = await createNote({ data: { ...values, idempotencyKey: crypto.randomUUID() } });
      if (result._tag === "invalid") { setErrors(result.fields); return; }
      if ((result._tag !== "applied" && result._tag !== "already_applied") || !result.value) { setErrors([{ field: "form", message: result._tag === "not_found" ? "The selected Course is no longer available." : "The Note could not be created." }]); return; }
      setCreateOpen(false);
      sessionStorage.setItem("kairo.note.notice", JSON.stringify({ message: "Note created.", token: result.undoToken }));
      await navigate({ to: "/notes/$noteId", params: { noteId: result.value.id }, search: { mode: "view" } });
    } finally { setPending(false); }
  };

  const undo = async () => {
    if (!notice?.token) return;
    const result = await undoNoteCommand({ data: { token: notice.token, idempotencyKey: crypto.randomUUID() } });
    setNotice({ message: result._tag === "applied" ? "Change undone." : "This change can no longer be undone." });
    if (result._tag === "applied") startTransition(() => void router.invalidate());
  };

  const filtered = Boolean(search.q || search.courseId);
  const openCreate = () => { setErrors([]); setCreateOpen(true); };
  return (
    <NoteShell>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-24 sm:px-6 md:py-8 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-2xl font-semibold text-kumo-strong">Notes</h1>
          <Dialog.Root open={createOpen} disablePointerDismissal onOpenChange={(open) => { if (!pending || open) setCreateOpen(open); }}>
            <Dialog.Trigger render={(props) => <Button {...props} onClick={(event) => { props.onClick?.(event); setErrors([]); }} icon={<Plus aria-hidden="true" size={16} weight="bold" />} className="active:scale-[0.96] transition-transform motion-reduce:active:scale-100">Create Note</Button>} />
            <Dialog className="flex h-[calc(100svh-1rem)] w-[calc(100vw-1rem)] max-w-none flex-col overflow-hidden overscroll-contain p-0 sm:h-[min(90svh,56rem)] sm:w-[min(92vw,72rem)]">
              <div className="flex shrink-0 items-center justify-between gap-4 border-b border-kumo-line px-4 py-3 sm:px-6"><Dialog.Title className="text-xl font-semibold">Create Note</Dialog.Title><Dialog.Close aria-label="Close Note editor" render={(props) => <Button {...props} title="Close Note editor" variant="secondary" shape="square" disabled={pending} className="min-h-11 min-w-11" icon={<X aria-hidden="true" size={18} />} />} /></div>
              <NoteForm courses={data.courses} errors={errors} pending={pending} onCancel={() => setCreateOpen(false)} onSubmit={create} />
            </Dialog>
          </Dialog.Root>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <form onSubmit={submitSearch} className="flex gap-2"><label className="sr-only" htmlFor="note-search">Search Notes</label><Input id="note-search" name="q" type="search" defaultValue={search.q ?? ""} placeholder="Search Notes" className="text-base sm:text-sm" /><Button type="submit" variant="secondary" shape="square" aria-label="Search Notes" icon={<MagnifyingGlass aria-hidden="true" size={18} />} /></form>
          <label className="sr-only" htmlFor="note-sort">Sort Notes</label><select id="note-sort" value={search.sort ?? "updated_desc"} onChange={(event) => void navigate({ search: (previous) => ({ ...previous, sort: event.target.value as "updated_desc" | "created_desc" | "title_asc", cursor: undefined }) })} className="min-h-11 rounded-lg bg-kumo-base px-3 text-base ring ring-kumo-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus sm:text-sm"><option value="updated_desc">Recently updated</option><option value="created_desc">Recently created</option><option value="title_asc">Title</option></select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Filter by Course">
          <FilterLink label="All" active={!search.courseId} onClick={() => void navigate({ search: (previous) => ({ ...previous, courseId: undefined, cursor: undefined }) })} />
          <FilterLink label="No Course" active={search.courseId === "none"} onClick={() => void navigate({ search: (previous) => ({ ...previous, courseId: "none", cursor: undefined }) })} />
          {data.courses.map((course) => <FilterLink key={course.id} label={course.title} active={search.courseId === course.id} onClick={() => void navigate({ search: (previous) => ({ ...previous, courseId: course.id, cursor: undefined }) })} />)}
        </div>

        <p role="status" className="mt-5 text-sm text-kumo-subtle">{data.items.length} {data.items.length === 1 ? "Note" : "Notes"}{data.hasNext ? " on this page" : ""}</p>
        {data.invalidCursor ? <p role="status" className="mt-2 text-sm text-kumo-warning">That page link expired. Showing the first page.</p> : null}
        {data.items.length === 0 ? (
          <LayerCard className="mt-5 px-6 py-10 text-center"><NoteBlank aria-hidden="true" size={28} className="mx-auto text-kumo-subtle" /><h2 className="mt-3 text-lg font-semibold">{filtered ? "No Notes match these filters" : "No Notes yet"}</h2><div className="mt-5 flex justify-center gap-2">{filtered ? <Button variant="secondary" onClick={() => void navigate({ search: { sort: search.sort, pageSize: search.pageSize } })}>Clear filters</Button> : null}<Button onClick={openCreate}>Create Note</Button></div></LayerCard>
        ) : (
          <LayerCard className="mt-5"><ol className="divide-y divide-kumo-line">{data.items.map((note) => <li key={note.id} className="px-4 py-4 sm:px-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><Link to="/notes/$noteId" params={{ noteId: note.id }} search={{ mode: "view" }} className="text-sm font-medium text-kumo-strong underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus">{note.title}</Link><div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-kumo-subtle">{note.courseTitle ? <Badge variant="secondary">{note.courseTitle}</Badge> : null}<time dateTime={note.updatedAt}>Updated {formatDate(note.updatedAt)}</time></div></div><Link to="/notes/$noteId" params={{ noteId: note.id }} search={{ mode: "view" }} className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-kumo-brand ring ring-kumo-line hover:bg-kumo-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus">View</Link></div>{note.preview ? <p className="mt-3 line-clamp-2 max-w-[75ch] text-sm leading-relaxed text-kumo-subtle">{note.preview}</p> : null}</li>)}</ol></LayerCard>
        )}
        {data.hasNext && data.nextCursor ? <div className="mt-5 flex justify-end"><Button variant="secondary" onClick={() => void navigate({ search: (previous) => ({ ...previous, cursor: data.nextCursor ?? undefined }) })}>Next page</Button></div> : null}
      </main>
      {notice ? <div role="status" className="fixed right-4 bottom-4 z-50 flex max-w-sm items-center gap-3 rounded-lg bg-kumo-strong px-4 py-3 text-sm text-kumo-inverse shadow-lg"><span>{notice.message}</span>{notice.token ? <button type="button" onClick={() => void undo()} className="min-h-11 font-medium underline underline-offset-4">Undo</button> : null}</div> : null}
    </NoteShell>
  );
}

function FilterLink({ label, active, onClick }: { readonly label: string; readonly active: boolean; readonly onClick: () => void }) { return <button type="button" aria-pressed={active} onClick={onClick} className={`min-h-10 rounded-lg px-3 text-sm font-medium ring ring-kumo-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus ${active ? "bg-kumo-strong text-kumo-inverse" : "bg-kumo-base hover:bg-kumo-tint"}`}>{label}</button>; }
function NotesLoading() { return <NoteShell><main className="mx-auto max-w-5xl px-4 py-8"><h1 className="text-2xl font-semibold">Notes</h1><div aria-label="Loading Notes" className="mt-8 grid gap-3">{[0, 1, 2].map((value) => <div key={value} className="h-24 animate-pulse rounded-lg bg-kumo-tint motion-reduce:animate-none" />)}</div></main></NoteShell>; }
function NotesError({ reset }: { readonly reset: () => void }) { return <NoteShell><main className="mx-auto max-w-3xl px-4 py-12"><WarningCircle aria-hidden="true" size={28} className="text-kumo-danger" /><h1 className="mt-3 text-2xl font-semibold">Notes unavailable</h1><Button className="mt-5" onClick={reset}>Retry</Button></main></NoteShell>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value)); }
