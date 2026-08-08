import { Button } from "@cloudflare/kumo/components/button";
import { Input, Textarea } from "@cloudflare/kumo/components/input";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

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
  const [mode, setMode] = useState<"write" | "preview">("write");
  const bodyId = useId();
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const dirty = title !== (note?.title ?? "") || bodyMarkdown !== (note?.bodyMarkdown ?? "") || courseId !== (note?.courseId ?? "");
  const fieldError = (field: string) => errors.find((error) => error.field === field)?.message;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (errors.length > 0) errorSummaryRef.current?.focus();
  }, [errors]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({ title, bodyMarkdown, courseId: courseId || null });
  };

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 py-4 sm:px-6 sm:py-5">
        {errors.length > 0 ? <div ref={errorSummaryRef} role="alert" tabIndex={-1} className="mb-4 rounded-lg bg-kumo-danger-tint px-4 py-3 text-sm text-kumo-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus"><p className="font-medium">Check the highlighted fields</p><ul className="mt-1 list-disc ps-5">{errors.map((error) => <li key={`${error.field}-${error.message}`}>{error.message}</li>)}</ul></div> : null}
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="grid content-start gap-1.5">
            <label className="text-sm font-medium" htmlFor={`${bodyId}-title`}>Title</label>
            <Input id={`${bodyId}-title`} name="title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required autoFocus={!note} aria-invalid={Boolean(fieldError("title"))} aria-describedby={fieldError("title") ? `${bodyId}-title-error` : undefined} />
            {fieldError("title") ? <p id={`${bodyId}-title-error`} className="text-sm text-kumo-danger">{fieldError("title")}</p> : null}
          </div>
          <label className="grid content-start gap-1.5 text-sm font-medium">Course<select name="courseId" value={courseId} onChange={(event) => setCourseId(event.target.value)} className="min-h-11 rounded-lg bg-kumo-base px-3 text-base font-normal ring ring-kumo-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus sm:text-sm"><option value="">No Course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col border-t border-kumo-line">
        <div className="flex shrink-0 items-center justify-between gap-3 bg-kumo-canvas px-4 py-2.5 sm:px-6">
          <span className="text-sm font-medium">Content</span>
          <div role="group" className="flex rounded-lg bg-kumo-tint p-1" aria-label="Content view">
            <button type="button" aria-pressed={mode === "write"} onClick={() => setMode("write")} className={`min-h-10 rounded-md px-3 text-sm font-medium transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100 ${mode === "write" ? "bg-kumo-base shadow-xs ring ring-kumo-line" : "hover:bg-kumo-base"}`}>Write</button>
            <button type="button" aria-pressed={mode === "preview"} onClick={() => setMode("preview")} className={`min-h-10 rounded-md px-3 text-sm font-medium transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100 ${mode === "preview" ? "bg-kumo-base shadow-xs ring ring-kumo-line" : "hover:bg-kumo-base"}`}>Preview</button>
          </div>
        </div>
        <Textarea id={bodyId} name="bodyMarkdown" aria-label="Note content" value={bodyMarkdown} onChange={(event) => setBodyMarkdown(event.target.value)} rows={14} className={`${mode === "preview" ? "hidden" : ""} mx-auto min-h-0 w-full max-w-[75ch] flex-1 resize-none rounded-none bg-kumo-base px-5 py-5 font-mono text-base leading-relaxed ring-0 focus:ring-inset sm:px-8 sm:text-sm`} aria-invalid={Boolean(fieldError("bodyMarkdown"))} aria-describedby={fieldError("bodyMarkdown") ? `${bodyId}-body-error` : undefined} />
        <div hidden={mode !== "preview"} role="region" aria-label="Note preview" className="min-h-0 flex-1 overflow-y-auto bg-kumo-base px-5 py-5 sm:px-8 sm:py-7">
          <div className="mx-auto w-full max-w-[75ch]">{bodyMarkdown ? <NoteMarkdown>{bodyMarkdown}</NoteMarkdown> : <p className="text-sm text-kumo-subtle">Start writing to see a preview.</p>}</div>
        </div>
        {fieldError("bodyMarkdown") ? <p id={`${bodyId}-body-error`} className="shrink-0 border-t border-kumo-line px-4 py-2 text-sm text-kumo-danger sm:px-6">{fieldError("bodyMarkdown")}</p> : null}
      </div>

      <div className="flex shrink-0 justify-end gap-2 border-t border-kumo-line bg-kumo-base px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-3"><Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>Cancel</Button><Button type="submit" disabled={pending} className="active:scale-[0.96] transition-transform motion-reduce:active:scale-100">{pending ? "Saving..." : note ? "Save changes" : "Create Note"}</Button></div>
    </form>
  );
}
