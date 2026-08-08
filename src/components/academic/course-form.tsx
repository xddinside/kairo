import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { useRef, type FormEvent } from "react";

import type { AcademicFieldError, Course } from "../../server/academic/domain";

/** Values emitted by the Course form. */
export interface CourseFormValues { readonly title: string; readonly code: string | null; readonly idempotencyKey: string }

/** Accessible Course create/edit form with a stable retry key. */
export function CourseForm({ course, errors, pending, onCancel, onSubmit }: { readonly course?: Course; readonly errors: ReadonlyArray<AcademicFieldError>; readonly pending: boolean; readonly onCancel: () => void; readonly onSubmit: (values: CourseFormValues) => void }) {
  const submission = useRef<{ readonly payload: string; readonly idempotencyKey: string } | undefined>(undefined);
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); const values = { title: String(data.get("title") ?? ""), code: String(data.get("code") ?? "").trim() || null }; const payload = JSON.stringify(values); const idempotencyKey = submission.current?.payload === payload ? submission.current.idempotencyKey : crypto.randomUUID(); submission.current = { payload, idempotencyKey }; onSubmit({ ...values, idempotencyKey }); };
  return <form onSubmit={submit} className="grid gap-5">{errors.length > 0 ? <div role="alert" className="rounded-lg bg-kumo-danger-tint px-4 py-3 text-sm text-kumo-danger">{errors.map((error) => <p key={`${error.field}-${error.message}`}>{error.message}</p>)}</div> : null}<label className="grid gap-1.5 text-sm font-medium">Title<Input name="title" defaultValue={course?.title ?? ""} maxLength={200} required /></label><label className="grid gap-1.5 text-sm font-medium">Code<Input name="code" defaultValue={course?.code ?? ""} maxLength={64} /></label><div className="sticky bottom-0 flex justify-end gap-2 border-t border-kumo-line bg-kumo-base pt-4"><Button type="button" variant="secondary" className="min-h-11" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={pending} className="min-h-11 transition-transform duration-150 ease-out active:scale-[0.96]">{pending ? "Saving..." : course ? "Save changes" : "Create course"}</Button></div></form>;
}
