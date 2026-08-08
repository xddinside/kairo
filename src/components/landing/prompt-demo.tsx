import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Spark, SparkDoodle } from "./spark";

type BlockShellProps = {
  label: string;
  children: ReactNode;
  delay: number;
};

function BlockShell({ label, children, delay }: BlockShellProps) {
  return (
    <div
      className="rise surface-flat rounded-xl px-4 py-3.5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2">
        <span className="flex size-5 items-center justify-center rounded-md bg-kumo-tint">
          <SparkDoodle className="size-3 text-kumo-brand" />
        </span>
        <span className="eyebrow text-kumo-subtle">{label}</span>
      </div>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

function DeadlineBlock({ due, chip }: { due: string; chip: string }) {
  return (
    <BlockShell label="Deadline" delay={320}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-kumo-default">{due}</span>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-kumo-tint px-2.5 py-1 text-xs font-medium tabular-nums text-kumo-strong">
          <span
            aria-hidden="true"
            className="size-1.5 animate-pulse-dot rounded-full bg-kumo-brand"
          />
          {chip}
        </span>
      </div>
    </BlockShell>
  );
}

function NotesBlock({ items }: { items: string[] }) {
  return (
    <BlockShell label="Notes" delay={520}>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-xs font-medium text-kumo-default">
            <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-kumo-inactive" />
            {item}
          </li>
        ))}
      </ul>
    </BlockShell>
  );
}

function ScheduleBlock({ rows }: { rows: { day: string; topic: string; done: boolean }[] }) {
  return (
    <BlockShell label="Timetable" delay={360}>
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li
            key={row.day}
            className={
              row.done
                ? "flex items-center gap-2 rounded-md bg-kumo-tint px-2.5 py-1.5"
                : "flex items-center gap-2 px-2.5 py-1.5"
            }
          >
            <span className="w-9 shrink-0 text-xs font-medium text-kumo-subtle">{row.day}</span>
            <span className="flex-1 truncate text-xs font-medium text-kumo-default">
              {row.topic}
            </span>
            <span
              aria-hidden="true"
              className={
                row.done
                  ? "flex size-4 items-center justify-center rounded-full bg-kumo-success text-[9px] font-bold text-white"
                  : "size-1.5 rounded-full bg-kumo-brand"
              }
            >
              {row.done ? "✓" : ""}
            </span>
          </li>
        ))}
      </ul>
    </BlockShell>
  );
}

function ChecklistBlock({ items }: { items: { label: string; done: boolean }[] }) {
  return (
    <BlockShell label="Next steps" delay={380}>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2.5 text-xs font-medium">
            <span
              aria-hidden="true"
              className={
                item.done
                  ? "flex size-4 shrink-0 items-center justify-center rounded-full bg-kumo-success text-[9px] font-bold text-white"
                  : "size-4 shrink-0 rounded-full border border-kumo-inactive"
              }
            >
              {item.done ? "✓" : ""}
            </span>
            <span className={item.done ? "text-kumo-inactive line-through" : "text-kumo-default"}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </BlockShell>
  );
}

function ProgressBlock({ label, pct, detail }: { label: string; pct: number; detail: string }) {
  return (
    <BlockShell label="Progress" delay={460}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-kumo-default">{label}</span>
        <span className="font-semibold tabular-nums text-kumo-strong">{pct}%</span>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-kumo-tint">
        <div className="h-full rounded-full bg-kumo-brand" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs font-medium text-kumo-subtle">{detail}</p>
    </BlockShell>
  );
}

type Composition = {
  title: string;
  blocks: ReactNode;
};

const compositions: Record<string, Composition> = {
  "essay due friday": {
    title: "Essay — due Friday",
    blocks: (
      <div className="grid gap-2.5 sm:grid-cols-2">
        <DeadlineBlock due="Due Friday" chip="2 days left" />
        <div className="sm:col-span-2">
          <NotesBlock
            items={[
              "Thesis: memory is a design choice",
              "Argue the counterpoint first, then win",
              "Cite two readings, then call it a night",
            ]}
          />
        </div>
      </div>
    ),
  },
  "stats exam in 3 days": {
    title: "Stats — exam in 3 days",
    blocks: (
      <div className="grid gap-2.5 sm:grid-cols-2">
        <ScheduleBlock
          rows={[
            { day: "Mon", topic: "Probability", done: true },
            { day: "Tue", topic: "Regression", done: true },
            { day: "Wed", topic: "Recap + past paper", done: false },
          ]}
        />
        <ProgressBlock label="Revision" pct={60} detail="6 of 10 topics covered" />
        <div className="sm:col-span-2">
          <NotesBlock
            items={[
              "Formula sheet: keep it to one side of A4",
              "Past paper 2025, Q3 was a trap",
            ]}
          />
        </div>
      </div>
    ),
  },
  "group project kickoff": {
    title: "Group project — kickoff",
    blocks: (
      <div className="grid gap-2.5 sm:grid-cols-2">
        <ChecklistBlock
          items={[
            { label: "Book room B204", done: true },
            { label: "Share outline by Tuesday", done: false },
            { label: "Assign slides per person", done: false },
          ]}
        />
        <NotesBlock
          items={[
            "Kickoff Tue 4pm · Room B204",
            "Everyone brings two questions",
          ]}
        />
      </div>
    ),
  },
};

function genericComposition(prompt: string): Composition {
  return {
    title: `Canvas for “${prompt}”`,
    blocks: (
      <div className="grid gap-2.5 sm:grid-cols-2">
        <DeadlineBlock due="Whenever you like" chip="no rush" />
        <div className="sm:col-span-2">
          <NotesBlock items={["Kairo keeps your context here", "Add notes as you go — they stay"]} />
        </div>
      </div>
    ),
  };
}

const chips = ["essay due friday", "stats exam in 3 days", "group project kickoff"];

export function PromptDemo() {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"idle" | "composing" | "composed">("idle");
  const [result, setResult] = useState<Composition | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, hovering: false });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const node = cardRef.current;
    if (!node) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const rect = node.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: -py * 2.2, y: px * 2.2, hovering: true });
  };

  const onPointerLeave = () => {
    setTilt({ x: 0, y: 0, hovering: false });
  };

  const compose = useCallback(
    (raw: string) => {
      const prompt = raw.trim().toLowerCase();
      if (!prompt || phase !== "idle") return;
      setPhase("composing");
      timers.current.push(
        setTimeout(() => {
          const next = compositions[prompt] ?? genericComposition(raw.trim());
          setResult(next);
          setPhase("composed");
        }, 900),
      );
    },
    [phase],
  );

  const reset = useCallback(() => {
    setPhase("idle");
    setResult(null);
  }, []);

  return (
    <div
      ref={cardRef}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="surface-glow rounded-2xl p-2"
    >
      <div
        className="h-full rounded-xl bg-kumo-base"
        style={{
          transform: `perspective(1400px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: tilt.hovering
            ? "transform 120ms cubic-bezier(0.23, 1, 0.32, 1)"
            : "transform 600ms cubic-bezier(0.16, 1, 0.3, 1)",
          willChange: tilt.hovering ? "transform" : "auto",
        }}
      >
        <div className="flex items-center justify-between px-3 pb-2 pt-2.5">
        <span className="flex items-center gap-2 text-xs font-medium text-kumo-subtle">
          <img src="/brand/kairo-icon.svg" alt="" className="size-3.5 shrink-0" />
          Your canvas
        </span>
        <span aria-hidden="true" className="flex gap-1">
          <span className="size-1.5 rounded-full bg-kumo-inactive" />
          <span className="size-1.5 rounded-full bg-kumo-inactive" />
          <span className="size-1.5 rounded-full bg-kumo-inactive" />
        </span>
      </div>

      <div className="rounded-xl bg-kumo-canvas px-4 py-8 sm:px-6">
        {phase === "idle" && (
          <div>
            <label
              htmlFor="kairo-prompt"
              className="eyebrow block text-kumo-brand"
            >
              What do you want to work on?
            </label>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                compose(text);
              }}
              className="mt-4 flex w-full items-center gap-2 rounded-full bg-kumo-base py-1.5 ps-5 pe-2 shadow-lg ring-kumo-line ring-1 transition-shadow focus-within:ring-2 focus-within:ring-kumo-focus/50"
            >
              <input
                id="kairo-prompt"
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ask Kairo to shape your day…"
                autoComplete="off"
                className="h-9 min-w-0 flex-1 border-0 bg-transparent px-0 font-sans text-lg text-kumo-default leading-6 outline-none placeholder:text-kumo-placeholder"
              />
              <button
                type="submit"
                disabled={!text.trim() || phase !== "idle"}
                aria-label="Generate my canvas"
                className="btn-primary flex size-9 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
              >
                <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
                  <path
                    d="M12 19V6M6.5 11.5 12 6l5.5 5.5"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </button>
            </form>

            <div className="mt-3 flex flex-col items-start">
              {chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    setText(chip);
                    compose(chip);
                  }}
                  className="btn-press group flex items-center gap-2.5 rounded-md px-3 py-2 text-lg text-kumo-subtle transition-colors hover:bg-kumo-tint hover:text-kumo-default"
                >
                  <SparkDoodle className="size-3.5 text-kumo-subtle transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:text-kumo-brand" />
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === "composing" && (
          <div className="flex h-44 flex-col items-center justify-center gap-4 sm:h-52">
            <Spark strokeWidth={6} className="size-9 animate-spin text-kumo-brand" />
            <p className="text-sm font-medium text-kumo-subtle">Composing your canvas…</p>
            <div className="h-1 w-40 overflow-hidden rounded-full bg-kumo-tint">
              <div className="h-full w-1/2 animate-shimmer rounded-full bg-kumo-brand" />
            </div>
          </div>
        )}

        {phase === "composed" && result && (
          <div>
            <div className="rise flex items-center gap-2.5" style={{ animationDelay: "80ms" }}>
              <span className="flex size-7 items-center justify-center rounded-md bg-kumo-tint">
                <img src="/brand/kairo-icon.svg" alt="" className="size-4" />
              </span>
              <h3 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight text-kumo-strong">
                {result.title}
              </h3>
              <button
                type="button"
                onClick={reset}
                className="btn-press flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-kumo-subtle transition-colors hover:bg-kumo-tint hover:text-kumo-default"
              >
                <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true">
                  <path
                    d="M4 10a8 8 0 1 1 2.5 6M4 10V4.5M4 10h5.5"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
                Re-compose
              </button>
            </div>
            <div className="mt-4">{result.blocks}</div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
