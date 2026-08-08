export function TasksMock() {
  return (
    <ul className="space-y-2">
      {[
        { label: "Outline essay", done: true },
        { label: "Read chapter 4", chip: "tomorrow", done: false },
        { label: "Email prof. Okafor", done: false },
      ].map((row) => (
        <li key={row.label} className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className={
              row.done
                ? "flex size-4 shrink-0 items-center justify-center rounded-full bg-kumo-success text-[9px] font-bold text-white"
                : "size-4 shrink-0 rounded-full border border-kumo-inactive"
            }
          >
            {row.done ? "✓" : ""}
          </span>
          <span
            className={
              row.done
                ? "text-xs font-medium text-kumo-inactive line-through"
                : "text-xs font-medium text-kumo-default"
            }
          >
            {row.label}
          </span>
          {row.chip && (
            <span className="ms-auto rounded-md bg-kumo-tint px-2 py-0.5 text-[10px] font-medium tabular-nums text-kumo-strong">
              {row.chip}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function TimetableMock() {
  return (
    <ul className="space-y-1.5">
      {[
        { day: "Mon", topic: "AINN · 9:00", active: true },
        { day: "Wed", topic: "Studio · 14:00", active: false },
        { day: "Fri", topic: "Seminar · 11:00", active: false },
      ].map((row) => (
        <li
          key={row.day}
          className={
            row.active
              ? "flex items-center gap-2 rounded-md bg-kumo-tint px-2.5 py-2"
              : "flex items-center gap-2 rounded-md bg-kumo-elevated px-2.5 py-2"
          }
        >
          <span className="w-7 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-kumo-subtle">
            {row.day}
          </span>
          <span className="flex-1 text-xs font-medium text-kumo-default">{row.topic}</span>
          {row.active && (
            <span aria-hidden="true" className="size-1.5 rounded-full bg-kumo-brand" />
          )}
        </li>
      ))}
    </ul>
  );
}

export function DeadlinesMock() {
  return (
    <ul className="space-y-2">
      {[
        { label: "Essay draft", chip: "2 days" },
        { label: "Lab report", chip: "5 days" },
      ].map((row) => (
        <li key={row.label} className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-kumo-default">{row.label}</span>
          <span className="rounded-md bg-kumo-tint px-2.5 py-1 text-[10px] font-medium tabular-nums text-kumo-strong">
            {row.chip}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function NotesMock() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        { title: "Essay ideas", body: "memory as a design choice…" },
        { title: "Reading list", body: "chapter 4, 7, 9 · skim 12" },
      ].map((note) => (
        <div key={note.title} className="rounded-lg bg-kumo-elevated p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-kumo-subtle">
            {note.title}
          </p>
          <p className="mt-1 text-[11px] font-medium leading-snug text-kumo-default">
            {note.body}
          </p>
        </div>
      ))}
    </div>
  );
}
