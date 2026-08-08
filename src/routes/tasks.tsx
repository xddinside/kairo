import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { ListChecks, MagnifyingGlass, Plus, X } from "@phosphor-icons/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { AcademicError, AcademicLoading } from "../components/academic/academic-feedback";
import { AcademicForm, type AcademicFormValues } from "../components/academic/academic-form";
import { AcademicShell } from "../components/academic/academic-shell";
import type { AcademicFieldError, AssessmentOption, CourseOption } from "../server/academic/domain";
import { createTask, listAssessmentOptions, listCourseOptions, listTasks } from "../server/academic/functions";
import { requireAuthenticatedRoute } from "../server/auth/functions";

const searchSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  status: z.enum(["open", "completed", "cancelled", "all"]).optional().catch("open"),
  courseId: z.string().uuid().optional().catch(undefined),
  assessment: z.union([z.literal("none"), z.string().uuid()]).optional().catch(undefined),
  window: z.enum(["all", "next7", "custom"]).optional().catch("all"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  sort: z.enum(["due_asc", "updated_desc", "title_asc"]).optional().catch("due_asc"),
  pageSize: z.coerce.number().pipe(z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)])).optional().catch(25),
  cursor: z.string().max(2048).optional().catch(undefined),
});

export const Route = createFileRoute("/tasks")({
  beforeLoad: requireAuthenticatedRoute,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const window = deps.window ?? "all";
    const from = window === "custom" && deps.from && deps.to && deps.from <= deps.to ? deps.from : null;
    const to = from ? deps.to ?? null : null;
    const [page, courseResult, assessmentResult] = await Promise.all([listTasks({ data: { q: deps.q?.trim() ?? "", status: deps.status ?? "open", courseId: deps.courseId ?? null, assessment: deps.assessment ?? null, window: from ? "custom" : window === "next7" ? "next7" : "all", from, to, sort: deps.sort ?? "due_asc", pageSize: deps.pageSize ?? 25, cursor: deps.cursor ?? null } }), listCourseOptions(), listAssessmentOptions()]);
    return { page, courses: isCourseOptions(courseResult) ? courseResult : [], assessments: isAssessmentOptions(assessmentResult) ? assessmentResult : [] };
  },
  pendingComponent: () => <AcademicLoading title="Tasks" />,
  errorComponent: ({ reset }) => <AcademicError title="Tasks unavailable" reset={reset} />,
  component: TasksRoute,
});

function TasksRoute() {
  const { page, courses, assessments } = Route.useLoaderData(); const search = Route.useSearch(); const navigate = Route.useNavigate();
  const [open, setOpen] = useState(false); const [pending, setPending] = useState(false); const [errors, setErrors] = useState<ReadonlyArray<AcademicFieldError>>([]);
  const create = async (values: AcademicFormValues) => { setPending(true); setErrors([]); try { const result = await createTask({ data: values }); if (result._tag === "invalid") setErrors(result.fields); else if ((result._tag === "applied" || result._tag === "already_applied") && result.value) { setOpen(false); sessionStorage.setItem("kairo.academic.notice", JSON.stringify({ message: "Task created.", token: result.undoToken })); await navigate({ to: "/tasks/$taskId", params: { taskId: result.value.id } }); } else setErrors([{ field: "form", message: result._tag === "not_found" ? "A selected course or assessment is no longer available." : "The task could not be created. Retry when ready." }]); } finally { setPending(false); } };
  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const q = String(new FormData(event.currentTarget).get("q") ?? "").trim(); void navigate({ search: (previous) => ({ ...previous, q: q || undefined, cursor: undefined }), replace: true }); };
  const setFilter = (next: Record<string, string | undefined>) => void navigate({ search: (previous) => ({ ...previous, ...next, cursor: undefined }) });
  const filtered = Boolean(search.q || search.courseId || search.assessment || search.status !== "open" || search.window !== "all");
  return <AcademicShell><main className="mx-auto w-full max-w-5xl px-4 py-6 pb-24 sm:px-6 md:py-8 lg:px-10">
    <div className="flex flex-wrap items-end justify-between gap-4"><h1 className="text-2xl font-semibold text-kumo-strong">Tasks</h1><Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Trigger render={(props) => <Button {...props} icon={<Plus aria-hidden="true" size={16} />} className="min-h-11 transition-transform duration-150 ease-out active:scale-[0.96]">Create task</Button>} /><Dialog className="max-h-[calc(100svh-1rem)] overflow-y-auto p-5 sm:max-w-2xl sm:p-6"><div className="mb-5 flex items-center justify-between"><Dialog.Title className="text-xl font-semibold">Create task</Dialog.Title><Dialog.Close aria-label="Close create task" render={(props) => <Button {...props} title="Close create task" variant="secondary" shape="square" className="min-h-11 min-w-11" icon={<X aria-hidden="true" size={18} />} />} /></div><AcademicForm kind="task" courses={courses} assessments={assessments} errors={errors} pending={pending} onCancel={() => setOpen(false)} onSubmit={create} /></Dialog></Dialog.Root></div>
    <div className="mt-6 grid gap-3"><form onSubmit={submitSearch} className="flex gap-2"><label htmlFor="task-search" className="sr-only">Search tasks</label><Input id="task-search" name="q" type="search" defaultValue={search.q ?? ""} placeholder="Search tasks" className="text-base sm:text-sm" /><Button type="submit" variant="secondary" shape="square" className="min-h-11 min-w-11" aria-label="Search tasks" icon={<MagnifyingGlass aria-hidden="true" size={18} />} /></form><div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6"><Select label="Status" value={search.status ?? "open"} onChange={(value) => setFilter({ status: value })} options={[["open", "Open"], ["completed", "Completed"], ["cancelled", "Cancelled"], ["all", "All statuses"]]} /><Select label="Course" value={search.courseId ?? ""} onChange={(value) => setFilter({ courseId: value || undefined })} options={[["", "All courses"], ...courses.map((course) => [course.id, course.title] as const)]} /><Select label="Assessment" value={search.assessment ?? ""} onChange={(value) => setFilter({ assessment: value || undefined })} options={[["", "All assessments"], ["none", "No assessment"], ...assessments.map((assessment) => [assessment.id, assessment.title] as const)]} /><Select label="Due" value={search.window ?? "all"} onChange={(value) => setFilter({ window: value })} options={[["all", "All dates"], ["next7", "Next seven days"], ["custom", "Custom range"]]} /><Select label="Sort" value={search.sort ?? "due_asc"} onChange={(value) => setFilter({ sort: value })} options={[["due_asc", "Due date"], ["updated_desc", "Recently updated"], ["title_asc", "Title"]]} /><Select label="Page size" value={String(search.pageSize ?? 25)} onChange={(value) => setFilter({ pageSize: value })} options={[["10", "10"], ["25", "25"], ["50", "50"], ["100", "100"]]} /></div>{search.window === "custom" ? <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-sm font-medium">From<Input type="date" value={search.from ?? ""} onChange={(event) => setFilter({ from: event.target.value || undefined })} /></label><label className="grid gap-1 text-sm font-medium">To<Input type="date" value={search.to ?? ""} onChange={(event) => setFilter({ to: event.target.value || undefined })} /></label></div> : null}</div>
    <p role="status" className="mt-5 text-sm text-kumo-subtle">{page.items.length} {page.items.length === 1 ? "task" : "tasks"}{page.hasNext ? " on this page" : ""}</p>{page.invalidCursor ? <p role="status" className="mt-2 text-sm text-kumo-warning">That page link expired. Showing the first page.</p> : null}
    {page.items.length === 0 ? <LayerCard className="mt-5 px-6 py-10 text-center"><ListChecks aria-hidden="true" size={28} className="mx-auto text-kumo-subtle" /><h2 className="mt-3 text-lg font-semibold">{filtered ? "No tasks match these filters" : "No tasks yet"}</h2><div className="mt-5 flex justify-center gap-2">{filtered ? <Button variant="secondary" onClick={() => void navigate({ search: {} })}>Clear filters</Button> : null}<Button onClick={() => setOpen(true)}>Create task</Button></div></LayerCard> : <LayerCard className="mt-5"><ol className="divide-y divide-kumo-line">{page.items.map((task) => <li key={task.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"><div className="min-w-0"><Link to="/tasks/$taskId" params={{ taskId: task.id }} className="text-sm font-medium text-kumo-strong underline-offset-4 hover:underline">{task.title}</Link><div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-kumo-subtle">{task.courseTitle ? <span>{task.courseTitle}</span> : null}{task.dueDate ? <time dateTime={`${task.dueDate}${task.dueTime ? `T${task.dueTime}` : ""}`}>{formatDue(task.dueDate, task.dueTime)}</time> : <span>No due date</span>}<Badge variant="secondary">{task.status}</Badge></div></div><Link to="/tasks/$taskId" params={{ taskId: task.id }} className="flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-kumo-brand ring ring-kumo-line hover:bg-kumo-tint">View</Link></li>)}</ol></LayerCard>}
    {page.hasNext && page.nextCursor ? <div className="mt-5 flex justify-end"><Button variant="secondary" onClick={() => void navigate({ search: (previous) => ({ ...previous, cursor: page.nextCursor ?? undefined }) })}>Next page</Button></div> : null}
  </main></AcademicShell>;
}

function Select({ label, value, options, onChange }: { readonly label: string; readonly value: string; readonly options: ReadonlyArray<readonly [string, string]>; readonly onChange: (value: string) => void }) { return <label className="grid gap-1 text-sm font-medium">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-lg bg-kumo-base px-3 text-base ring ring-kumo-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus sm:text-sm">{options.map(([key, text]) => <option key={key || "all"} value={key}>{text}</option>)}</select></label>; }
function formatDue(date: string, time: string | null) { const day = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); return time ? `${day} at ${time}` : day; }
function isCourseOptions(value: unknown): value is ReadonlyArray<CourseOption> { return Array.isArray(value) && value.every((item) => typeof item === "object" && item !== null && "id" in item && "title" in item && !("status" in item)); }
function isAssessmentOptions(value: unknown): value is ReadonlyArray<AssessmentOption> { return Array.isArray(value) && value.every((item) => typeof item === "object" && item !== null && "courseId" in item && !("status" in item)); }
