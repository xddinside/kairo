import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { Check, PencilSimple } from "@phosphor-icons/react";
import { useRouter } from "@tanstack/react-router";
import { Schema } from "effect";
import { startTransition, useState, type FormEvent } from "react";

import type { Task } from "../../server/academic/domain";
import { createTask, setTaskStatus, updateTask } from "../../server/academic/functions";
import { GeneratedViewSpec } from "../../server/generation/domain";

type Props = {
  readonly spec: unknown;
  readonly tasks: ReadonlyArray<Task>;
  readonly onAction: (action: string, input: unknown) => Promise<void>;
};

const parsedSpec = (value: unknown) => Schema.decodeUnknownOption(GeneratedViewSpec)(value, { onExcessProperty: "error" });

/** Render a validated Kairo catalog spec and route approved Actions through Domain commands. */
export function GeneratedView({ spec, tasks, onAction }: Props) {
  const decoded = parsedSpec(spec);
  if (decoded._tag === "None") {
    return <LayerCard className="px-5 py-5"><Text as="h2" variant="heading3">This saved view is unavailable</Text></LayerCard>;
  }
  return (
    <div className="grid gap-5">
      <Text as="h2" variant="heading2">{decoded.value.title}</Text>
      {decoded.value.blocks.map((block, index) => {
        if (block.type === "Summary") return <Summary key={`${block.type}-${index}`} heading={block.heading} body={block.body} />;
        if (block.type === "TaskCreator") return <TaskCreator key={`${block.type}-${index}`} heading={block.heading} onAction={onAction} />;
        const selected = block.taskIds.flatMap((id) => {
          const task = tasks.find((candidate) => candidate.id === id);
          return task ? [task] : [];
        });
        return <TaskList key={`${block.type}-${index}`} heading={block.heading} tasks={selected} onAction={onAction} />;
      })}
    </div>
  );
}

function Summary({ heading, body }: { readonly heading: string; readonly body: string }) {
  return <LayerCard className="px-5 py-5"><div className="grid gap-2"><Text as="h3" variant="heading3">{heading}</Text><p className="text-sm leading-6 text-kumo-subtle">{body}</p></div></LayerCard>;
}

function TaskList({ heading, tasks, onAction }: { readonly heading: string; readonly tasks: ReadonlyArray<Task>; readonly onAction: Props["onAction"] }) {
  return <section className="grid gap-3"><Text as="h3" variant="heading3">{heading}</Text><LayerCard><ul className="divide-y divide-kumo-line">{tasks.map((task) => <TaskRow key={task.id} task={task} onAction={onAction} />)}{tasks.length === 0 ? <li className="px-5 py-5 text-sm text-kumo-subtle">No matching Tasks are available.</li> : null}</ul></LayerCard></section>;
}

function TaskRow({ task, onAction }: { readonly task: Task; readonly onAction: Props["onAction"] }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const changed = () => startTransition(() => void router.invalidate());
  const toggle = async () => {
    setPending(true);
    try {
      const result = await setTaskStatus({ data: { id: task.id, expectedVersion: task.version, status: task.status === "completed" ? "open" : "completed", idempotencyKey: crypto.randomUUID() } });
      if (result._tag === "applied" || result._tag === "already_applied") { await onAction("task.status", { taskId: task.id, status: task.status === "completed" ? "open" : "completed" }); changed(); }
    } finally { setPending(false); }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setPending(true);
    try {
      const result = await updateTask({ data: { taskId: task.id, expectedVersion: task.version, patch: { title: title.trim() }, idempotencyKey: crypto.randomUUID() } });
      if (result._tag === "applied" || result._tag === "already_applied") { await onAction("task.update", { taskId: task.id, title: title.trim() }); setEditing(false); changed(); }
    } finally { setPending(false); }
  };
  return <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">{editing ? <form className="flex min-w-0 flex-1 gap-2" onSubmit={save}><Input aria-label={`Edit ${task.title}`} value={title} onChange={(event) => setTitle(event.target.value)} autoFocus /><Button type="submit" size="sm" disabled={pending}>Save</Button><Button type="button" size="sm" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button></form> : <><div className="flex min-w-0 items-center gap-3"><button type="button" disabled={pending} aria-label={task.status === "completed" ? `Reopen ${task.title}` : `Complete ${task.title}`} onClick={() => void toggle()} className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${task.status === "completed" ? "border-kumo-success bg-kumo-success text-white" : "border-kumo-line"}`}>{task.status === "completed" ? <Check aria-hidden="true" size={13} weight="bold" /> : null}</button><div className="grid min-w-0 gap-1"><span className={task.status === "completed" ? "text-sm text-kumo-subtle line-through" : "text-sm font-medium text-kumo-default"}>{task.title}</span>{task.courseTitle ? <span className="text-xs text-kumo-subtle">{task.courseTitle}</span> : null}</div></div><div className="flex items-center gap-2"><Badge variant={task.status === "completed" ? "success" : "secondary"}>{task.status === "completed" ? "Done" : "Open"}</Badge><Button variant="ghost" shape="square" size="sm" aria-label={`Edit ${task.title}`} icon={<PencilSimple aria-hidden="true" size={15} />} onClick={() => setEditing(true)} /></div></>}</li>;
}

function TaskCreator({ heading, onAction }: { readonly heading: string; readonly onAction: Props["onAction"] }) {
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setPending(true);
    try {
      const result = await createTask({ data: { title: title.trim(), idempotencyKey: crypto.randomUUID() } });
      if (result._tag === "applied" || result._tag === "already_applied") { await onAction("task.create", { title: title.trim() }); setTitle(""); startTransition(() => void router.invalidate()); }
    } finally { setPending(false); }
  };
  return <LayerCard className="px-5 py-5"><form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" onSubmit={submit}><div className="grid gap-2"><label htmlFor="canvas-task-title" className="text-sm font-medium text-kumo-default">{heading}</label><Input id="canvas-task-title" value={title} onChange={(event) => setTitle(event.target.value)} /></div><Button type="submit" disabled={pending || !title.trim()}>{pending ? "Adding" : "Add Task"}</Button></form></LayerCard>;
}
