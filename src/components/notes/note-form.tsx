import { Button } from "@cloudflare/kumo/components/button";
import { Input, Textarea } from "@cloudflare/kumo/components/input";
import { useEffect, useState, type FormEvent } from "react";

import type { Note, NoteCourseOption, NoteFieldError } from "../../server/notes/domain";
import { NoteMarkdown } from "./note-markdown";

/** Values submitted by the shared Note create and edit form. */
export interface NoteFormValues {
  readonly title: string;
  readonly bodyMarkdown: string;
  readonly courseId: string | null;
}

type NoteFormProps = {
  readonly note?: Note;
  readonly courses: ReadonlyArray<NoteCourseOption>;
  readonly errors: ReadonlyArray<NoteFieldError>;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (values: NoteFormValues) => void;
};

/** Explicit-save Markdown form for creating or editing a Note. */
export function NoteForm({ note, courses, errors, pending, onCancel, onSubmit }: NoteFormProps) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [bodyMarkdown, setBodyMarkdown] = useState(note?.bodyMarkdown ?? "");
  const [courseId, setCourseId] = useState(note?.courseId ?? "");
  const [preview, setPreview] = useState(false);
  const dirty = title !== (note?.title ?? "") || bodyMarkdown !== (note?.bodyMarkdown ?? "") || courseId !== (note?.courseId ?? "");
  const fieldError = (field: string) => errors.find((error) => error.field === field)?.message;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({ title, bodyMarkdown, courseId: courseId || null });
  };

  return (
    <form onSubmit={submit} className="grid gap-5">
      {errors.length > 0 ? <div role="alert" tabIndex={-1} className="rounded-lg bg-kumo-danger-tint px-4 py-3 text-sm text-kumo-danger"><p className="font-medium">Check the highlighted fields</p><ul className="mt-1 list-disc ps-5">{errors.map((error) => <li key={`${error.field}-${error.message}`}>{error.message}</li>)}</ul></div> : null}
      <label className="grid gap-1.5 text-sm font-medium">Title<Input name="title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required aria-invalid={Boolean(fieldError("title"))} aria-describedby={fieldError("title") ? "note-title-error" : undefined} /></label>
      {fieldError("title") ? <p id="note-title-error" className="-mt-4 text-sm text-kumo-danger">{fieldError("title")}</p> : null}
      <label className="grid gap-1.5 text-sm font-medium">Course<select name="courseId" value={courseId} onChange={(event) => setCourseId(event.target.value)} className="min-h-11 rounded-lg bg-kumo-base px-3 text-base ring ring-kumo-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus sm:text-sm"><option value="">No Course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">Markdown</span><div className="flex rounded-lg bg-kumo-tint p-1" aria-label="Markdown display"><button type="button" aria-pressed={!preview} onClick={() => setPreview(false)} className={`min-h-10 rounded-md px-3 text-sm font-medium ${!preview ? "bg-kumo-base shadow-xs ring ring-kumo-line" : "hover:bg-kumo-base"}`}>Write</button><button type="button" aria-pressed={preview} onClick={() => setPreview(true)} className={`min-h-10 rounded-md px-3 text-sm font-medium ${preview ? "bg-kumo-base shadow-xs ring ring-kumo-line" : "hover:bg-kumo-base"}`}>Preview</button></div></div>
        {preview ? <div className="min-h-64 rounded-lg bg-kumo-base px-5 py-4 ring ring-kumo-line">{bodyMarkdown ? <NoteMarkdown>{bodyMarkdown}</NoteMarkdown> : <p className="text-sm text-kumo-subtle">Nothing to preview.</p>}</div> : <Textarea name="bodyMarkdown" aria-label="Markdown" value={bodyMarkdown} onChange={(event) => setBodyMarkdown(event.target.value)} rows={14} className="font-mono text-base leading-relaxed sm:text-sm" aria-invalid={Boolean(fieldError("bodyMarkdown"))} aria-describedby={fieldError("bodyMarkdown") ? "note-body-error" : undefined} />}
        {fieldError("bodyMarkdown") ? <p id="note-body-error" className="text-sm text-kumo-danger">{fieldError("bodyMarkdown")}</p> : null}
      </div>
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-kumo-line bg-kumo-base pt-4 pb-[env(safe-area-inset-bottom)]"><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={pending} className="active:scale-[0.96] transition-transform">{pending ? "Saving..." : note ? "Save changes" : "Create Note"}</Button></div>
    </form>
  );
}
