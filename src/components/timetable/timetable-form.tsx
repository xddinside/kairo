import { Button } from "@cloudflare/kumo/components/button";
import { Input, Textarea } from "@cloudflare/kumo/components/input";
import { CalendarBlank, Repeat, WarningCircle } from "@phosphor-icons/react";
import { useState, type FormEvent, type ReactNode } from "react";

import type { TimetableEntry, TimetableFieldError } from "../../server/timetable/domain";
import { WEEKDAY_INITIALS, WEEKDAY_NAMES } from "./timetable-dates";

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

const KINDS = [
  { value: "one_off", label: "One-off", icon: CalendarBlank },
  { value: "weekly", label: "Weekly", icon: Repeat },
] as const;

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

  const toggleDay = (day: number) =>
    setSelectedDays(
      selectedDays.includes(day)
        ? selectedDays.filter((value) => value !== day)
        : [...selectedDays, day].sort((left, right) => left - right),
    );

  return (
    <form onSubmit={submit} className="grid gap-5">
      {errors.length > 0 ? (
        <div
          role="alert"
          tabIndex={-1}
          className="flex gap-2.5 rounded-lg bg-kumo-danger-tint px-4 py-3 text-base text-kumo-danger ring ring-kumo-danger/20"
        >
          <span className="h-lh flex shrink-0 items-center">
            <WarningCircle aria-hidden="true" size={17} weight="fill" />
          </span>
          <div className="min-w-0">
            <p className="font-medium">Check the highlighted fields</p>
            <ul className="mt-1 grid list-disc gap-0.5 ps-4">
              {errors.map((error) => (
                <li key={`${error.field}-${error.message}`}>{error.message}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <FormField label="Title" error={fieldError("title")}>
        <Input
          name="title"
          defaultValue={entry?.title ?? ""}
          maxLength={160}
          required
          autoComplete="off"
          aria-invalid={Boolean(fieldError("title"))}
        />
      </FormField>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-base font-medium text-kumo-strong">Repeats</legend>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-kumo-tint p-1 ring ring-kumo-line">
          {KINDS.map((option) => {
            const selected = kind === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setKind(option.value)}
                className={`flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-base font-medium transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus active:scale-[0.97] ${
                  selected
                    ? "bg-kumo-base text-kumo-strong shadow-xs ring ring-kumo-line"
                    : "text-kumo-subtle hover:bg-kumo-base/60"
                }`}
              >
                <span className="h-lh flex items-center">
                  <option.icon aria-hidden="true" size={15} />
                </span>
                {option.label}
              </button>
            );
          })}
        </div>
        {fieldError("kind") ? <p className="text-sm text-kumo-danger">{fieldError("kind")}</p> : null}
      </fieldset>

      {kind === "weekly" ? (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-base font-medium text-kumo-strong">Weekdays</legend>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAY_INITIALS.map((label, day) => {
              const selected = selectedDays.includes(day);
              return (
                <button
                  key={label}
                  type="button"
                  aria-label={WEEKDAY_NAMES[day]}
                  aria-pressed={selected}
                  onClick={() => toggleDay(day)}
                  className={`flex min-h-10 items-center justify-center rounded-lg text-base font-medium ring transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus active:scale-[0.96] ${
                    selected
                      ? "bg-kumo-brand text-white shadow-xs ring-kumo-brand"
                      : "bg-kumo-base text-kumo-default ring-kumo-line hover:bg-kumo-tint"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {fieldError("daysOfWeek") ? <p className="text-sm text-kumo-danger">{fieldError("daysOfWeek")}</p> : null}
        </fieldset>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Start date" error={fieldError("startDate")}>
          <Input
            type="date"
            name="startDate"
            defaultValue={entry?.startDate ?? initialDate}
            required
            aria-invalid={Boolean(fieldError("startDate"))}
          />
        </FormField>
        {kind === "weekly" ? (
          <FormField label="End date" error={fieldError("endDate")}>
            <Input
              type="date"
              name="endDate"
              defaultValue={entry?.endDate ?? initialDate}
              required
              aria-invalid={Boolean(fieldError("endDate"))}
            />
          </FormField>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Starts" error={fieldError("startTime")}>
          <Input
            type="time"
            name="startTime"
            defaultValue={entry?.startTime ?? "09:00"}
            required
            className="tabular-nums"
            aria-invalid={Boolean(fieldError("startTime"))}
          />
        </FormField>
        <FormField label="Ends" error={fieldError("endTime")}>
          <Input
            type="time"
            name="endTime"
            defaultValue={entry?.endTime ?? "10:00"}
            required
            className="tabular-nums"
            aria-invalid={Boolean(fieldError("endTime"))}
          />
        </FormField>
      </div>

      <FormField label="Details" error={fieldError("details")}>
        <Textarea name="details" defaultValue={entry?.details ?? ""} maxLength={5000} rows={4} />
      </FormField>

      <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 border-t border-kumo-line bg-kumo-base px-5 py-4 sm:-mx-6 sm:-mb-6 sm:px-6">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          className="min-h-10 transition-transform duration-150 ease-out active:scale-[0.96]"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={pending}
          className="min-h-10 shadow-sm transition-transform duration-150 ease-out active:scale-[0.96]"
        >
          {pending ? "Saving…" : entry ? "Save changes" : "Create entry"}
        </Button>
      </div>
    </form>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  readonly label: string;
  readonly error?: string;
  readonly children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-base font-medium text-kumo-strong">{label}</span>
      {children}
      {error ? <span className="text-sm text-kumo-danger">{error}</span> : null}
    </label>
  );
}
