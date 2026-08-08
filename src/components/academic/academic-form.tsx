import { Button } from "@cloudflare/kumo/components/button";
import { Input, Textarea } from "@cloudflare/kumo/components/input";
import { useRef, type FormEvent } from "react";

import type { AcademicFieldError, Assessment, AssessmentOption, CourseOption, Task } from "../../server/academic/domain";

/** Values emitted by the Task and Assessment form. */
export interface AcademicFormValues {
  readonly title: string;
  readonly details: string | null;
  readonly courseId: string | null;
  readonly assessmentId?: string | null;
  readonly dueDate: string | null;
  readonly dueTime: string | null;
  readonly idempotencyKey: string;
}

/** Shared accessible Task and Assessment create/edit form. */
export function AcademicForm({ kind, record, courses, assessments = [], errors, pending, onCancel, onSubmit }: { readonly kind: "task" | "assessment"; readonly record?: Task | Assessment; readonly courses: ReadonlyArray<CourseOption>; readonly assessments?: ReadonlyArray<AssessmentOption>; readonly errors: ReadonlyArray<AcademicFieldError>; readonly pending: boolean; readonly onCancel: () => void; readonly onSubmit: (values: AcademicFormValues) => void }) {
  const submission = useRef<{ readonly payload: string; readonly idempotencyKey: string } | undefined>(undefined);
  const fieldError = (field: string) => errors.find((error) => error.field === field)?.message;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const dueDate = String(data.get("dueDate") ?? "") || null;
    const base = { title: String(data.get("title") ?? ""), details: String(data.get("details") ?? "").trim() || null, courseId: String(data.get("courseId") ?? "") || null, dueDate, dueTime: dueDate ? String(data.get("dueTime") ?? "") || null : null };
    const values = kind === "task" ? { ...base, assessmentId: String(data.get("assessmentId") ?? "") || null } : base;
    const payload = JSON.stringify(values);
    const idempotencyKey = submission.current?.payload === payload ? submission.current.idempotencyKey : crypto.randomUUID();
    submission.current = { payload, idempotencyKey };
    onSubmit({ ...values, idempotencyKey });
  };
  return <form onSubmit={submit} className="grid gap-5">
    {errors.length > 0 ? <div role="alert" tabIndex={-1} className="rounded-lg bg-kumo-danger-tint px-4 py-3 text-sm text-kumo-danger"><p className="font-medium">Check the highlighted fields</p><ul className="mt-1 list-disc ps-5">{errors.map((error) => <li key={`${error.field}-${error.message}`}>{error.message}</li>)}</ul></div> : null}
    <Field label="Title" error={fieldError("title")}><Input name="title" defaultValue={record?.title ?? ""} maxLength={200} required /></Field>
    <label className="grid gap-1.5 text-sm font-medium">Course<select name="courseId" defaultValue={record?.courseId ?? ""} className="min-h-11 rounded-lg bg-kumo-base px-3 text-base ring ring-kumo-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus sm:text-sm"><option value="">No course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}{course.code ? ` (${course.code})` : ""}</option>)}</select></label>
    {kind === "task" ? <label className="grid gap-1.5 text-sm font-medium">Assessment<select name="assessmentId" defaultValue={(record && "assessmentId" in record ? record.assessmentId : null) ?? ""} className="min-h-11 rounded-lg bg-kumo-base px-3 text-base ring ring-kumo-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus sm:text-sm"><option value="">No assessment</option>{assessments.map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.title}</option>)}</select></label> : null}
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Due date" error={fieldError("dueDate")}><Input type="date" name="dueDate" defaultValue={record?.dueDate ?? ""} /></Field><Field label="Due time" error={fieldError("dueTime")}><Input type="time" name="dueTime" defaultValue={record?.dueTime ?? ""} /></Field></div>
    <Field label="Details" error={fieldError("details")}><Textarea name="details" defaultValue={record?.details ?? ""} maxLength={5000} rows={5} /></Field>
    <div className="sticky bottom-0 flex justify-end gap-2 border-t border-kumo-line bg-kumo-base pt-4 pb-[env(safe-area-inset-bottom)]"><Button type="button" variant="secondary" className="min-h-11" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={pending} className="min-h-11 transition-transform duration-150 ease-out active:scale-[0.96]">{pending ? "Saving..." : record ? "Save changes" : `Create ${kind}`}</Button></div>
  </form>;
}

function Field({ label, error, children }: { readonly label: string; readonly error?: string; readonly children: React.ReactElement }) {
  return <label className="grid gap-1.5 text-sm font-medium">{label}{children}{error ? <span className="text-sm font-normal text-kumo-danger">{error}</span> : null}</label>;
}
