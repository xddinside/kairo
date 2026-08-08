import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { ArrowLeft, PencilSimple, Trash, WarningCircle } from "@phosphor-icons/react";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { startTransition, useEffect, useState } from "react";
import { z } from "zod";

import { NoteForm, type NoteFormValues } from "../components/notes/note-form";
import { NoteMarkdown } from "../components/notes/note-markdown";
import { NoteShell } from "../components/notes/note-shell";
import { requireAuthenticatedRoute } from "../server/auth/functions";
import type { NoteCommandResult, NoteFieldError } from "../server/notes/domain";
import { deleteNote, getNote, listNoteCourses, undoNoteCommand, updateNote } from "../server/notes/functions";

const detailSearch = z.object({ mode: z.enum(["view", "edit"]).optional().catch("view") });

export const Route = createFileRoute("/notes/$noteId")({
  beforeLoad: requireAuthenticatedRoute,
  validateSearch: detailSearch,
  loader: async ({ params }) => {
    const [note, courses] = await Promise.all([getNote({ data: { noteId: params.noteId } }), listNoteCourses()]);
    if (!note) throw notFound();
    return { note, courses };
  },
  component: NoteDetailRoute,
  notFoundComponent: () => <NoteShell><main className="mx-auto max-w-3xl px-4 py-12"><h1 className="text-2xl font-semibold">Note not found</h1><Link to="/notes" className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-kumo-brand">Back to Notes</Link></main></NoteShell>,
});

function NoteDetailRoute() {
  const { note, courses } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const editing = search.mode === "edit";
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<ReadonlyArray<NoteFieldError>>([]);
  const [notice, setNotice] = useState<{ readonly message: string; readonly token?: string }>();
  const refresh = () => startTransition(() => void router.invalidate());

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

  const update = async (values: NoteFormValues) => {
    setPending(true); setErrors([]);
    try {
      const result = await updateNote({ data: { noteId: note.id, expectedVersion: note.version, ...values, idempotencyKey: crypto.randomUUID() } });
      if (result._tag === "invalid") { setErrors(result.fields); return; }
      if (result._tag === "conflict") { setErrors([{ field: "form", message: "This Note changed elsewhere. Your edits are still here. Reload to see the current version." }]); return; }
      if (result._tag !== "applied" && result._tag !== "already_applied") { setErrors([{ field: "form", message: "The selected Course or Note is no longer available." }]); return; }
      setNotice({ message: "Note saved.", token: result.undoToken });
      await navigate({ search: { mode: "view" }, replace: true });
      refresh();
    } finally { setPending(false); }
  };

  const remove = async () => {
    setPending(true);
    try {
      const result = await deleteNote({ data: { noteId: note.id, expectedVersion: note.version, idempotencyKey: crypto.randomUUID() } });
      if (result._tag === "applied" || result._tag === "already_applied") { setDeleteOpen(false); sessionStorage.setItem("kairo.note.notice", JSON.stringify({ message: "Note deleted.", token: result.undoToken })); await navigate({ to: "/notes" }); return; }
      setErrors([{ field: "form", message: result._tag === "conflict" ? "This Note changed. Reload before deleting it." : "The Note is no longer available." }]);
    } finally { setPending(false); }
  };

  const undo = async () => {
    if (!notice?.token) return;
    const result: NoteCommandResult = await undoNoteCommand({ data: { token: notice.token, idempotencyKey: crypto.randomUUID() } });
    setNotice({ message: result._tag === "applied" ? "Change undone." : "This change can no longer be undone." });
    if (result._tag === "applied") refresh();
  };

  return (
    <NoteShell>
      <main className="mx-auto max-w-5xl px-4 py-6 pb-24 sm:px-6 md:py-8 lg:px-10">
        <Link to="/notes" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-kumo-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus"><ArrowLeft aria-hidden="true" size={16} />Back to Notes</Link>
        {editing ? (
          <div className="mt-4"><h1 className="text-2xl font-semibold text-kumo-strong">Edit Note</h1><LayerCard className="mt-6 px-5 py-5 sm:px-6"><NoteForm note={note} courses={courses} errors={errors} pending={pending} onCancel={() => void navigate({ search: { mode: "view" } })} onSubmit={update} /></LayerCard></div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h1 className="text-2xl font-semibold text-kumo-strong text-wrap-balance">{note.title}</h1><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-kumo-subtle">{note.courseTitle ? <Badge variant="secondary">{note.courseTitle}</Badge> : null}<time dateTime={note.updatedAt}>Updated {formatDate(note.updatedAt)}</time></div></div><div className="flex gap-2"><Button variant="secondary" icon={<PencilSimple aria-hidden="true" size={16} />} onClick={() => void navigate({ search: { mode: "edit" } })}>Edit</Button><Button variant="secondary" icon={<Trash aria-hidden="true" size={16} />} onClick={() => setDeleteOpen(true)}>Delete</Button></div></div>
            <article className="mt-7 min-h-64 rounded-xl bg-kumo-base px-5 py-5 shadow-sm ring ring-kumo-line sm:px-8 sm:py-7">{note.bodyMarkdown ? <NoteMarkdown>{note.bodyMarkdown}</NoteMarkdown> : <p className="text-sm text-kumo-subtle">This Note is empty.</p>}</article>
          </>
        )}
        <Dialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}><Dialog className="p-5 sm:max-w-md sm:p-6"><WarningCircle aria-hidden="true" size={24} className="text-kumo-danger" /><Dialog.Title className="mt-3 text-xl font-semibold">Delete {note.title}?</Dialog.Title><Dialog.Description className="mt-2 text-sm text-kumo-subtle">The Note will be removed from Notes and Canvas.</Dialog.Description><div className="mt-6 flex justify-end gap-2"><Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button disabled={pending} onClick={() => void remove()}>Delete Note</Button></div></Dialog></Dialog.Root>
      </main>
      {notice ? <div role="status" className="fixed right-4 bottom-4 z-50 flex max-w-sm items-center gap-3 rounded-lg bg-kumo-strong px-4 py-3 text-sm text-kumo-inverse shadow-lg"><span>{notice.message}</span>{notice.token ? <button type="button" onClick={() => void undo()} className="min-h-11 font-medium underline underline-offset-4">Undo</button> : null}</div> : null}
    </NoteShell>
  );
}

function formatDate(value: string) { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
