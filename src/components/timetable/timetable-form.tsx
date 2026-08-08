import { Button } from "@cloudflare/kumo/components/button";
import { Input, Textarea } from "@cloudflare/kumo/components/input";
import { useState, type FormEvent } from "react";

import type { TimetableEntry, TimetableFieldError } from "../../server/timetable/domain";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Values submitted by the shared Timetable create and edit form. */
export interface TimetableFormValues {
  readonly title: string;
  readonly details: string | null;
  readonly courseId: string | null;
  readonly kind: "one_off" | "weekly";
  readonly startDate: string;
  readonly endDate: string;
  readonly daysOfWeek: ReadonlyArray<number>;
  readonly startTime: string;
  readonly endTime: string;
}

type TimetableFormProps = {
  readonly entry?: TimetableEntry;
  readonly initialDate: string;
  readonly errors: ReadonlyArray<TimetableFieldError>;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (values: TimetableFormValues) => void;
};

/** Accessible form for creating or replacing a Timetable entry. */
export function TimetableForm({ entry, initialDate, errors, pending, onCancel, onSubmit }: TimetableFormProps) {
  const [kind, setKind] = useState<"one_off" | "weekly">(entry?.kind ?? "one_off");
  const [selectedDays, setSelectedDays] = useState<ReadonlyArray<number>>(entry?.daysOfWeek ?? []);
  const fieldError = (field: string) => errors.find((error) => error.field === field)?.message;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const startDate = String(data.get("startDate") ?? initialDate);
    onSubmit({
      title: String(data.get("title") ?? ""),
      details: String(data.get("details") ?? "").trim() || null,
      courseId: entry?.courseId ?? null,
      kind,
      startDate,
      endDate: kind === "one_off" ? startDate : String(data.get("endDate") ?? startDate),
      daysOfWeek: kind === "weekly" ? selectedDays : [],
      startTime: String(data.get("startTime") ?? ""),
      endTime: String(data.get("endTime") ?? ""),
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-5">
      {errors.length > 0 ? <div role="alert" tabIndex={-1} className="rounded-lg bg-kumo-danger-tint px-4 py-3 text-sm text-kumo-danger"><p className="font-medium">Check the highlighted fields</p><ul className="mt-1 list-disc ps-5">{errors.map((error) => <li key={`${error.field}-${error.message}`}>{error.message}</li>)}</ul></div> : null}
      <label className="grid gap-1.5 text-sm font-medium text-kumo-default">Title<Input name="title" defaultValue={entry?.title ?? ""} maxLength={160} required aria-invalid={Boolean(fieldError("title"))} /></label>
      <fieldset className="grid gap-2"><legend className="text-sm font-medium">Repeats</legend><div className="grid grid-cols-2 gap-2">{(["one_off", "weekly"] as const).map((value) => <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)} className={`min-h-11 rounded-lg px-3 text-sm font-medium ring ring-kumo-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus ${kind === value ? "bg-kumo-brand text-white" : "bg-kumo-base text-kumo-default hover:bg-kumo-tint"}`}>{value === "one_off" ? "One-off" : "Weekly"}</button>)}</div></fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">Start date<Input type="date" name="startDate" defaultValue={entry?.startDate ?? initialDate} required aria-invalid={Boolean(fieldError("startDate"))} /></label>
        {kind === "weekly" ? <label className="grid gap-1.5 text-sm font-medium">End date<Input type="date" name="endDate" defaultValue={entry?.endDate ?? initialDate} required aria-invalid={Boolean(fieldError("endDate"))} /></label> : null}
      </div>
      {kind === "weekly" ? <fieldset className="grid gap-2"><legend className="text-sm font-medium">Weekdays</legend><div className="grid grid-cols-4 gap-2 sm:grid-cols-7">{weekdays.map((label, day) => { const selected = selectedDays.includes(day); return <button key={label} type="button" aria-pressed={selected} onClick={() => setSelectedDays(selected ? selectedDays.filter((value) => value !== day) : [...selectedDays, day].sort())} className={`min-h-11 rounded-lg text-sm font-medium ring ring-kumo-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus ${selected ? "bg-kumo-brand text-white" : "bg-kumo-base hover:bg-kumo-tint"}`}>{label}</button>; })}</div>{fieldError("daysOfWeek") ? <p className="text-sm text-kumo-danger">{fieldError("daysOfWeek")}</p> : null}</fieldset> : null}
      <div className="grid grid-cols-2 gap-4">
        <label className="grid gap-1.5 text-sm font-medium">Starts<Input type="time" name="startTime" defaultValue={entry?.startTime ?? "09:00"} required aria-invalid={Boolean(fieldError("startTime"))} /></label>
        <label className="grid gap-1.5 text-sm font-medium">Ends<Input type="time" name="endTime" defaultValue={entry?.endTime ?? "10:00"} required aria-invalid={Boolean(fieldError("endTime"))} /></label>
      </div>
      <label className="grid gap-1.5 text-sm font-medium">Details<Textarea name="details" defaultValue={entry?.details ?? ""} maxLength={5000} rows={4} /></label>
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-kumo-line bg-kumo-base pt-4"><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Saving..." : entry ? "Save changes" : "Create entry"}</Button></div>
    </form>
  );
}
