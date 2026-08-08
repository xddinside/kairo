import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Empty } from "@cloudflare/kumo/components/empty";
import { Input } from "@cloudflare/kumo/components/input";
import { InputGroup } from "@cloudflare/kumo/components/input-group";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Select } from "@cloudflare/kumo/components/select";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import { Text } from "@cloudflare/kumo/components/text";
import {
  ArrowRight,
  CheckCircle,
  CircleDashed,
  CircleNotch,
  Clock,
  ListChecks,
  MagnifyingGlass,
  Plus,
  X,
} from "@phosphor-icons/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";

import {
  AcademicError,
  AcademicLoading,
} from "../components/academic/academic-feedback";
import {
  AcademicForm,
  type AcademicFormValues,
} from "../components/academic/academic-form";
import { AcademicShell } from "../components/academic/academic-shell";
import type {
  AcademicFieldError,
  AcademicStatus,
  AssessmentOption,
  CourseOption,
  Task,
} from "../server/academic/domain";
import {
  createTask,
  listAssessmentOptions,
  listCourseOptions,
  listTasks,
} from "../server/academic/functions";
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
  const { page, courses, assessments } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<ReadonlyArray<AcademicFieldError>>([]);
  const [filters, setFilters] = useState(search);
  useEffect(() => setFilters(search), [search]);

  const create = async (values: AcademicFormValues) => {
    setPending(true);
    setErrors([]);
    try {
      const result = await createTask({ data: values });
      if (result._tag === "invalid") {
        setErrors(result.fields);
      } else if ((result._tag === "applied" || result._tag === "already_applied") && result.value) {
        setOpen(false);
        sessionStorage.setItem("kairo.academic.notice", JSON.stringify({ message: "Task created.", token: result.undoToken }));
        await navigate({ to: "/tasks/$taskId", params: { taskId: result.value.id } });
      } else {
        setErrors([{ field: "form", message: result._tag === "not_found" ? "A selected course or assessment is no longer available." : "The task could not be created. Retry when ready." }]);
      }
    } finally {
      setPending(false);
    }
  };

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    const next = { ...filters, q: q || undefined, cursor: undefined };
    setFilters(next);
    void navigate({ search: next, replace: true });
  };

  const setFilter = (next: Record<string, string | undefined>) => {
    const value = { ...filters, ...next, cursor: undefined };
    setFilters(value);
    void navigate({ search: value, replace: true });
  };

  const filtered = Boolean(filters.q || filters.courseId || filters.assessment || filters.status !== "open" || filters.window !== "all");
  const visibleItems = page.items.filter((task) =>
    (!filters.q || task.title.toLocaleLowerCase().includes(filters.q.toLocaleLowerCase())) &&
    (!filters.courseId || task.courseId === filters.courseId) &&
    (!filters.assessment || (filters.assessment === "none" ? task.assessmentId === null : task.assessmentId === filters.assessment)) &&
    (!filters.status || filters.status === "all" || task.status === filters.status),
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <AcademicShell>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 pb-24 sm:px-6 md:py-12 lg:px-10">
        <header className="flex items-start justify-between gap-5">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-kumo-base text-kumo-brand shadow-sm ring ring-kumo-line">
              <ListChecks aria-hidden="true" size={21} weight="regular" />
            </span>
            <div className="min-w-0">
              <Text as="h1" variant="heading1">
                Tasks
              </Text>
              <div className="mt-1 text-sm text-kumo-subtle tabular-nums">
                {page.items.length} {page.items.length === 1 ? "task" : "tasks"}
                {page.hasNext ? " on this page" : ""}
              </div>
            </div>
          </div>
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger
              render={(props) => (
                <Button
                  {...props}
                  variant="primary"
                  icon={<Plus aria-hidden="true" size={16} weight="bold" />}
                  className="min-h-10 shrink-0 rounded-lg shadow-sm transition-transform duration-150 ease-out active:scale-[0.96]"
                >
                  Create task
                </Button>
              )}
            />
            <Dialog className="max-h-[calc(100svh-2rem)] overflow-y-auto p-5 sm:max-w-xl sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <Dialog.Title className="text-xl font-semibold">
                  Create task
                </Dialog.Title>
                <Dialog.Close
                  aria-label="Close create task"
                  render={(props) => (
                    <Button
                      {...props}
                      title="Close create task"
                      variant="secondary"
                      shape="square"
                      className="min-h-10 min-w-10"
                      icon={<X aria-hidden="true" size={18} />}
                    />
                  )}
                />
              </div>
              <AcademicForm
                kind="task"
                courses={courses}
                assessments={assessments}
                errors={errors}
                pending={pending}
                onCancel={() => setOpen(false)}
                onSubmit={create}
              />
            </Dialog>
          </Dialog.Root>
        </header>

        <LayerCard className="mt-9">
          <LayerCard.Primary className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <form
              onSubmit={submitSearch}
              role="search"
              className="min-w-0 flex-1 sm:max-w-md"
            >
              <label htmlFor="task-search" className="sr-only">
                Search tasks
              </label>
              <InputGroup size="lg">
                <InputGroup.Addon>
                  <MagnifyingGlass
                    aria-hidden="true"
                    size={17}
                    className="text-kumo-subtle"
                  />
                </InputGroup.Addon>
                <InputGroup.Input
                  id="task-search"
                  name="q"
                  type="search"
                  defaultValue={search.q ?? ""}
                  placeholder="Search tasks"
                />
              </InputGroup>
              <button type="submit" className="sr-only">
                Search
              </button>
            </form>
            <div role="group" aria-label="Task status" className="min-w-0">
              <Tabs
                variant="segmented"
                size="sm"
                value={filters.status ?? "open"}
                onValueChange={(status) => {
                  setFilter({ status: status || "open" });
                }}
                tabs={[
                  { value: "open", label: "Open" },
                  { value: "completed", label: "Completed" },
                  { value: "cancelled", label: "Cancelled" },
                  { value: "all", label: "All" },
                ]}
              />
            </div>
          </LayerCard.Primary>
          <LayerCard.Secondary className="flex flex-col gap-3 px-3 py-3 sm:px-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select
                aria-label="Course"
                size="lg"
                value={filters.courseId ?? "all"}
                onValueChange={(value) => {
                  if (value === null) return;
                  setFilter({ courseId: value === "all" ? undefined : value });
                }}
                items={{
                  all: "All courses",
                  ...Object.fromEntries(courses.map((course) => [course.id, course.title])),
                }}
                className="w-full"
              />
              <Select
                aria-label="Assessment"
                size="lg"
                value={filters.assessment ?? "all"}
                onValueChange={(value) => {
                  if (value === null) return;
                  setFilter({
                    assessment: value === "all" ? undefined : value,
                  });
                }}
                items={{
                  all: "All assessments",
                  none: "No assessment",
                  ...Object.fromEntries(assessments.map((assessment) => [assessment.id, assessment.title])),
                }}
                className="w-full"
              />
              <Select
                aria-label="Due window"
                size="lg"
                value={filters.window ?? "all"}
                onValueChange={(value) => {
                  if (value === null) return;
                  setFilter({
                    window: value,
                    ...(value !== "custom" ? { from: undefined, to: undefined } : {}),
                  });
                }}
                items={{
                  all: "All dates",
                  next7: "Next seven days",
                  custom: "Custom range",
                }}
                className="w-full"
              />
              <Select
                aria-label="Sort"
                size="lg"
                value={filters.sort ?? "due_asc"}
                onValueChange={(value) => {
                  if (value === null) return;
                  setFilter({ sort: value });
                }}
                items={{
                  due_asc: "Due date",
                  updated_desc: "Recently updated",
                  title_asc: "Title",
                }}
                className="w-full"
              />
            </div>
            {filters.window === "custom" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">
                  From
                  <Input
                    type="date"
                    value={filters.from ?? ""}
                    onChange={(event) => setFilter({ from: event.target.value || undefined })}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  To
                  <Input
                    type="date"
                    value={filters.to ?? ""}
                    onChange={(event) => setFilter({ to: event.target.value || undefined })}
                  />
                </label>
              </div>
            ) : null}
          </LayerCard.Secondary>
        </LayerCard>

        <section className="mt-9" aria-labelledby="task-list-heading">
          <div className="mb-3 flex items-center justify-between px-1">
            <Text as="h2" variant="heading3" id="task-list-heading">
              Task list
            </Text>
            {filtered ? (
              <button
                type="button"
                onClick={() => void navigate({ search: {} })}
                className="min-h-9 rounded-lg px-3 text-sm font-medium text-kumo-brand hover:bg-kumo-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus"
              >
                Clear filters
              </button>
            ) : null}
          </div>

          {page.invalidCursor ? (
            <p role="status" className="mb-3 rounded-lg bg-kumo-warning-tint px-4 py-3 text-sm text-kumo-warning">
              That page link expired. Showing the first page.
            </p>
          ) : null}

          {visibleItems.length === 0 ? (
            <LayerCard>
              <Empty
                size="base"
                icon={
                  filtered ? (
                    <span className="flex size-12 items-center justify-center rounded-xl bg-kumo-tint text-kumo-subtle ring ring-kumo-line">
                      <MagnifyingGlass aria-hidden="true" size={23} />
                    </span>
                  ) : (
                    <span className="flex size-12 items-center justify-center rounded-xl bg-kumo-brand text-kumo-inverse shadow-sm">
                      <ListChecks aria-hidden="true" size={23} />
                    </span>
                  )
                }
                title={filtered ? "No matching tasks" : "No tasks yet"}
                contents={
                  filtered ? (
                    <Button
                      variant="primary"
                      onClick={() => void navigate({ search: {} })}
                      className="transition-transform duration-150 ease-out active:scale-[0.96]"
                    >
                      Clear filters
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      icon={<Plus aria-hidden="true" size={16} weight="bold" />}
                      onClick={() => setOpen(true)}
                      className="shadow-sm transition-transform duration-150 ease-out active:scale-[0.96]"
                    >
                      Create your first task
                    </Button>
                  )
                }
              />
            </LayerCard>
          ) : (
            <LayerCard>
              <ol className="divide-y divide-kumo-line">
                {visibleItems.map((task) => (
                  <TaskRow key={task.id} task={task} today={today} />
                ))}
              </ol>
            </LayerCard>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 px-1">
            <p role="status" className="text-sm text-kumo-subtle tabular-nums">
              {page.items.length} {page.items.length === 1 ? "task" : "tasks"}
              {page.hasNext ? " on this page" : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                aria-label="Results per page"
                size="sm"
                value={String(search.pageSize ?? 25)}
                onValueChange={(value) => {
                  if (value === null) return;
                  void navigate({
                    search: (previous) => ({
                      ...previous,
                      pageSize: Number(value),
                      cursor: undefined,
                    }),
                  });
                }}
                items={{
                  "10": "10 results",
                  "25": "25 results",
                  "50": "50 results",
                  "100": "100 results",
                }}
                className="w-36"
              />
              {page.hasNext && page.nextCursor ? (
                <Button
                  variant="secondary"
                  className="min-h-10 rounded-lg"
                  onClick={() =>
                    void navigate({
                      search: (previous) => ({
                        ...previous,
                        cursor: page.nextCursor ?? undefined,
                      }),
                    })
                  }
                >
                  Next page
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </AcademicShell>
  );
}

const STATUS_STYLES: Record<AcademicStatus, { readonly className: string; readonly icon: typeof ListChecks }> = {
  open: {
    className: "bg-kumo-brand-tint text-kumo-brand",
    icon: CircleNotch,
  },
  completed: {
    className: "bg-kumo-success-tint text-kumo-success",
    icon: CheckCircle,
  },
  cancelled: {
    className: "bg-kumo-fill text-kumo-subtle",
    icon: CircleDashed,
  },
};

function TaskRow({ task, today }: { readonly task: Task; readonly today: string }) {
  const style = STATUS_STYLES[task.status];
  const overdue = task.status === "open" && task.dueDate !== null && task.dueDate < today;
  const Icon = style.icon;
  const due = task.dueDate ? (
    <time dateTime={`${task.dueDate}${task.dueTime ? `T${task.dueTime}` : ""}`}>
      {formatDue(task.dueDate, task.dueTime)}
    </time>
  ) : (
    <span>No due date</span>
  );
  return (
    <li className="min-w-0">
      <Link
        to="/tasks/$taskId"
        params={{ taskId: task.id }}
        className="group flex min-w-0 items-center gap-4 px-4 py-4 outline-none transition-colors hover:bg-kumo-tint/40 focus-visible:ring-2 focus-visible:ring-kumo-focus/50 focus-visible:ring-offset-2 focus-visible:ring-offset-kumo-canvas sm:px-5"
      >
        <span
          aria-hidden="true"
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ring ring-kumo-line ${style.className}`}
        >
          <Icon size={18} weight="regular" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-kumo-strong underline-offset-4 group-hover:underline">
            {task.title}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-kumo-subtle">
            {task.courseTitle ? (
              <span className="truncate font-medium text-kumo-default">
                {task.courseTitle}
              </span>
            ) : (
              <span>No course</span>
            )}
            <span className="flex items-center gap-1">
              <Clock aria-hidden="true" size={13} />
              <span className={overdue ? "text-kumo-danger" : ""}>{due}</span>
            </span>
            {overdue ? <span className="text-kumo-danger">Overdue</span> : null}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-kumo-tint text-kumo-subtle ring ring-kumo-line transition-colors group-hover:bg-kumo-brand group-hover:text-kumo-inverse"
        >
          <ArrowRight
            size={15}
            weight="bold"
            className="transition-transform duration-150 ease-out group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none"
          />
        </span>
      </Link>
    </li>
  );
}

function formatDue(date: string, time: string | null) {
  const day = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
  return time ? `${day} at ${formatTime(time)}` : day;
}

function formatTime(value: string) {
  const [hour = 0, minute = 0] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}

function isCourseOptions(value: unknown): value is ReadonlyArray<CourseOption> {
  return Array.isArray(value) && value.every((item) => typeof item === "object" && item !== null && "id" in item && "title" in item && !("status" in item));
}
function isAssessmentOptions(value: unknown): value is ReadonlyArray<AssessmentOption> {
  return Array.isArray(value) && value.every((item) => typeof item === "object" && item !== null && "courseId" in item && !("status" in item));
}
