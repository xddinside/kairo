import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { Clock, Note, Play, X } from "@phosphor-icons/react";
import { Link, useLocation } from "@tanstack/react-router";

import {
  contextSummary,
  quietSuggestions,
  studyWindows,
  todayClasses,
  linkedNotes,
  type PlanItem,
} from "./canvas-data";

export type TodayRoute =
  "/canvas/today" | "/proto/a/today" | "/proto/b/today" | "/proto/c/today";

export const chipLinkClass =
  "text-lg text-kumo-default transition-transform hover:text-kumo-strong active:scale-[0.96]";

export function ContextLine({ align = "left" }: { align?: "left" | "center" }) {
  return (
    <p
      className={`text-base text-kumo-subtle${align === "center" ? " text-center" : ""}`}
    >
      {contextSummary.courses} · {contextSummary.openTasks} ·{" "}
      <span className="font-medium text-kumo-warning">
        {contextSummary.overdue}
      </span>{" "}
      · {contextSummary.next}
    </p>
  );
}

type PromptBoxProps = {
  defaultValue?: string;
  size?: "base" | "lg";
  submitTo: string;
};

export function PromptBox({
  defaultValue,
  size = "base",
  submitTo,
}: PromptBoxProps) {
  return (
    <form action={submitTo} className="flex w-full items-center gap-2">
      <div className="w-full flex-1">
        <Input
          size={size}
          name="prompt"
          defaultValue={defaultValue}
          placeholder="Ask Kairo to shape your day…"
          aria-label="Ask Kairo"
        />
      </div>
      <Button
        variant="primary"
        size={size}
        type="submit"
        className="transition-transform active:scale-[0.96]"
      >
        Generate
      </Button>
    </form>
  );
}

export function PromptBar({
  defaultValue,
  submitTo,
}: {
  defaultValue?: string;
  submitTo: string;
}) {
  return (
    <form
      action={submitTo}
      className="flex w-full items-center gap-2 rounded-full bg-kumo-base py-1.5 ps-5 pe-2 shadow-lg ring ring-kumo-line transition-shadow focus-within:ring-2 focus-within:ring-kumo-focus/50"
    >
      <input
        name="prompt"
        defaultValue={defaultValue}
        placeholder="Ask Kairo to shape your day…"
        aria-label="Ask Kairo"
        className="h-9 min-w-0 flex-1 border-0 bg-transparent px-0 font-sans text-lg text-kumo-default leading-6 placeholder:text-kumo-placeholder outline-none focus:outline-none focus:ring-0"
      />
      <Button
        variant="primary"
        size="base"
        type="submit"
        className="shrink-0 rounded-full text-lg transition-transform duration-150 ease-out active:scale-[0.96]"
      >
        Generate
      </Button>
    </form>
  );
}

export function DockedPromptBar({
  defaultValue,
  inSidebarShell = false,
  submitTo,
}: {
  defaultValue?: string;
  inSidebarShell?: boolean;
  submitTo: string;
}) {
  return (
    <div
      className={`fixed inset-x-0 bottom-4 z-40${
        inSidebarShell
          ? " md:left-(--sidebar-width) md:group-data-[state=collapsed]/sidebar-wrapper:left-(--sidebar-width-icon)"
          : ""
      }`}
    >
      <div className="mx-auto w-full max-w-2xl px-6">
        <PromptBar defaultValue={defaultValue} submitTo={submitTo} />
      </div>
    </div>
  );
}

export function SuggestionChips({ to }: { to: TodayRoute }) {
  return (
    <ul className="flex w-full flex-col items-start gap-1.5">
      {quietSuggestions.map((suggestion) => {
        const Icon = suggestion.icon;
        return (
          <li key={suggestion.text}>
            <Link
              to={to}
              className="group flex items-center gap-2.5 rounded-md px-3 py-2 text-lg text-kumo-subtle transition-transform hover:bg-kumo-tint hover:text-kumo-default active:scale-[0.96]"
            >
              <span className="flex h-lh items-center text-kumo-subtle group-hover:text-kumo-strong">
                <Icon size={18} weight="regular" />
              </span>
              <span className="flex-1">{suggestion.text}</span>
              <span
                aria-hidden="true"
                className="flex h-lh items-center rounded-md p-1 text-kumo-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:bg-kumo-base"
              >
                <X size={16} weight="regular" />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function ViewHeader({
  variant = "heading2",
}: {
  variant?: "heading1" | "heading2";
}) {
  return (
    <div className="grid gap-1.5">
      <Text as="h1" variant={variant}>
        Today's plan
      </Text>
      <Text variant="secondary" size="base">
        Monday 3 August · generated at 8:00 AM
      </Text>
    </div>
  );
}

const timingBadgeVariant = {
  Now: "success",
  Next: "info",
  Later: "secondary",
} as const;

export function CurrentFocusBlock({ item }: { item: PlanItem }) {
  return (
    <LayerCard>
      <LayerCard.Secondary className="flex-wrap justify-between gap-x-4 gap-y-1 px-5 py-3">
        <span className="flex items-center gap-2 text-sm font-medium text-kumo-default tabular-nums">
          <span aria-hidden className="size-1.5 rounded-full bg-kumo-success" />
          Now · {item.window}
        </span>
        <span className="text-sm font-normal text-kumo-subtle">
          {item.context}
        </span>
      </LayerCard.Secondary>
      <LayerCard.Primary className="gap-4 px-5 py-4 pr-5">
        <div className="grid gap-1.5">
          <Text as="h2" variant="heading3">
            {item.title}
          </Text>
          <p className="text-sm text-kumo-subtle">
            {item.course} · {item.duration}
          </p>
        </div>
        <p className="text-sm leading-6 text-kumo-subtle">{item.reason}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            className="text-sm transition-transform duration-150 ease-out active:not-disabled:scale-[0.96]"
          >
            <Play aria-hidden="true" size={14} weight="bold" className="translate-x-px" /> Start focus
          </Button>
          {item.note ? (
            <Button
              variant="ghost"
              aria-label={`Open note: ${item.note}`}
              className="text-sm transition-transform duration-150 ease-out active:not-disabled:scale-[0.96]"
            >
              <Note aria-hidden="true" size={14} weight="bold" /> Open note
            </Button>
          ) : null}
        </div>
      </LayerCard.Primary>
    </LayerCard>
  );
}

export function NextStepsBlock({ items }: { items: PlanItem[] }) {
  return (
    <section className="grid gap-3" aria-labelledby="next-steps-heading">
      <Text as="h2" variant="heading3" id="next-steps-heading">
        Next steps
      </Text>
      <LayerCard>
        <ol className="divide-y divide-kumo-line">
          {items.map((item) => (
            <li
              key={item.title}
              className="grid gap-3 px-5 py-4 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-4"
            >
              <div className="text-sm font-medium text-kumo-default tabular-nums">
                {item.window}
              </div>
              <div className="grid min-w-0 gap-1.5">
                <div className="flex items-start justify-between gap-3">
                  <Text as="h3" bold size="lg">
                    {item.title}
                  </Text>
                  {item.overdue ? <Badge variant="error">Overdue</Badge> : null}
                </div>
                <p className="text-sm text-kumo-subtle">
                  {item.course} · {item.duration} · {item.context}
                </p>
                <p className="text-sm leading-6 text-kumo-subtle">{item.reason}</p>
              </div>
            </li>
          ))}
        </ol>
      </LayerCard>
    </section>
  );
}

function PlanMeta({ item }: { item: PlanItem }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-kumo-subtle">
      <span className="flex items-center gap-1.5 tabular-nums">
        <Clock size={16} /> {item.duration}
      </span>
      <span aria-hidden>·</span>
      <span>{item.course}</span>
    </p>
  );
}

export function PlanItemCard({
  item,
  emphasized = false,
}: {
  item: PlanItem;
  emphasized?: boolean;
}) {
  if (emphasized) {
    return (
      <LayerCard className="px-5 py-4">
        <div className="grid gap-4">
          <div className="flex items-center gap-2">
            <Badge variant={timingBadgeVariant[item.timing]}>
              {item.timing}
            </Badge>
            {item.overdue ? <Badge variant="error">Overdue</Badge> : null}
          </div>
          <div className="grid gap-1.5">
            <Text as="h2" variant="heading3">
              {item.title}
            </Text>
            <PlanMeta item={item} />
          </div>
          <Text variant="secondary" size="base">
            {item.reason}
          </Text>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              className="text-lg transition-transform active:scale-[0.96]"
            >
              <Play size={16} /> Start {item.duration} focus
            </Button>
            {item.note ? (
              <Button
                variant="ghost"
                className="text-lg transition-transform active:scale-[0.96]"
              >
                <Note size={16} /> {item.note}
              </Button>
            ) : null}
          </div>
        </div>
      </LayerCard>
    );
  }

  return (
    <LayerCard className="px-5 py-4">
      <div className="grid gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={timingBadgeVariant[item.timing]}>{item.timing}</Badge>
          {item.when ? (
            <span className="text-base text-kumo-subtle">{item.when}</span>
          ) : null}
          {item.overdue ? <Badge variant="error">Overdue</Badge> : null}
        </div>
        <Text bold size="lg">
          {item.title}
        </Text>
        <PlanMeta item={item} />
        <Text variant="secondary" size="base">
          {item.reason}
        </Text>
      </div>
    </LayerCard>
  );
}

export function ClassesCard() {
  return (
    <LayerCard className="px-5 py-4">
      <div className="grid gap-3">
        <Text as="h2" variant="heading3">
          Today's classes
        </Text>
        <ul className="grid gap-2">
          {todayClasses.map((entry) => (
            <li
              key={entry.time}
              className="flex items-baseline justify-between gap-4"
            >
              <span className="text-lg">{entry.name}</span>
              <span className="shrink-0 text-base text-kumo-subtle">
                {entry.time}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-kumo-subtle">
          Open study windows: {studyWindows.join(" · ")}
        </p>
      </div>
    </LayerCard>
  );
}

export function NotesCard() {
  return (
    <LayerCard className="px-5 py-4">
      <div className="grid gap-3">
        <Text as="h2" variant="heading3">
          Linked notes
        </Text>
        <ul className="grid gap-3">
          {linkedNotes.map((note) => (
            <li key={note.title} className="grid gap-1">
              <span className="flex items-start gap-1.5">
                <span className="flex h-lh items-center">
                  <Note size={16} />
                </span>
                <span className="text-lg font-medium">{note.title}</span>
              </span>
              <span className="text-base text-kumo-subtle">{note.preview}</span>
            </li>
          ))}
        </ul>
      </div>
    </LayerCard>
  );
}

const protoLayouts = [
  { id: "a", label: "A" },
  { id: "b", label: "B" },
  { id: "c", label: "C" },
] as const;

const quietRoutes = { a: "/proto/a", b: "/proto/b", c: "/proto/c" } as const;
const todayRoutes = {
  a: "/proto/a/today",
  b: "/proto/b/today",
  c: "/proto/c/today",
} as const;

function segmentClass(active: boolean) {
  return `rounded-full px-2.5 py-1 text-sm font-medium ${
    active
      ? "bg-kumo-fill text-kumo-strong"
      : "text-kumo-default hover:bg-kumo-tint"
  }`;
}

export function ProtoSwitcher() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const searchStr = useLocation({
    select: (location) => location.searchStr,
  });

  const lifecycleMatch = /^\/proto\/lifecycle\/?$/.exec(pathname);
  if (lifecycleMatch) {
    const params = new URLSearchParams(searchStr ?? "");
    const phase = params.get("phase") ?? "signin";
    const phases = [
      { id: "signin", label: "Sign in" },
      { id: "canvas", label: "Canvas" },
      { id: "settings", label: "Settings" },
    ] as const;

    return (
      <div className="pointer-events-none fixed top-4 right-4 z-50 flex justify-end">
        <nav
          aria-label="Account lifecycle prototype"
          className="pointer-events-auto flex items-center gap-1 rounded-full bg-kumo-base p-1 shadow-md ring ring-kumo-line"
        >
          <span className="pr-1 pl-2 text-xs text-kumo-subtle">Account</span>
          {phases.map((item) => (
            <Link
              key={item.id}
              to="/proto/lifecycle"
              search={{ phase: item.id }}
              className={segmentClass(item.id === phase)}
              aria-current={item.id === phase ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
          <span aria-hidden className="mx-0.5 h-4 w-px bg-kumo-line" />
          <Link
            to="/proto/lifecycle"
            search={{ phase: phase as "signin" | "canvas" | "settings", reset: true }}
            className={segmentClass(false)}
          >
            Reset
          </Link>
          <span aria-hidden className="mx-0.5 h-4 w-px bg-kumo-line" />
          <Link to="/proto" className={segmentClass(false)}>
            Index
          </Link>
        </nav>
      </div>
    );
  }

  const match = /^\/proto\/([abc])(\/today)?\/?$/.exec(pathname);
  if (!match) return null;
  const current = match[1] as keyof typeof quietRoutes;
  const isToday = match[2] != null;

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-50 flex justify-end">
      <nav
        aria-label="Prototype layouts"
        className="pointer-events-auto flex items-center gap-1 rounded-full bg-kumo-base p-1 shadow-md ring ring-kumo-line"
      >
        <span className="pr-1 pl-2 text-xs text-kumo-subtle">Layout</span>
        {protoLayouts.map((layout) => (
          <Link
            key={layout.id}
            to={isToday ? todayRoutes[layout.id] : quietRoutes[layout.id]}
            className={segmentClass(layout.id === current)}
            aria-current={layout.id === current ? "page" : undefined}
          >
            {layout.label}
          </Link>
        ))}
        <span aria-hidden className="mx-0.5 h-4 w-px bg-kumo-line" />
        <Link
          to={quietRoutes[current]}
          className={segmentClass(!isToday)}
          aria-current={!isToday ? "page" : undefined}
        >
          Quiet
        </Link>
        <Link
          to={todayRoutes[current]}
          className={segmentClass(isToday)}
          aria-current={isToday ? "page" : undefined}
        >
          Today
        </Link>
        <span aria-hidden className="mx-0.5 h-4 w-px bg-kumo-line" />
        <Link to="/proto" className={segmentClass(false)}>
          Index
        </Link>
      </nav>
    </div>
  );
}
