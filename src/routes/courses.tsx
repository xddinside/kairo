import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Empty } from "@cloudflare/kumo/components/empty";
import { InputGroup } from "@cloudflare/kumo/components/input-group";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Select } from "@cloudflare/kumo/components/select";
import { Text } from "@cloudflare/kumo/components/text";
import {
  Archive,
  BookOpen,
  Books,
  DotsThree,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { startTransition, useEffect, useState } from "react";
import { z } from "zod";

import {
  AcademicError,
  AcademicLoading,
  AcademicToast,
} from "../components/academic/academic-feedback";
import { AcademicShell } from "../components/academic/academic-shell";
import {
  CourseForm,
  type CourseFormValues,
} from "../components/academic/course-form";
import type { AcademicFieldError, Course } from "../server/academic/domain";
import {
  archiveCourse,
  createCourse,
  deleteCourse,
  listCourses,
  reopenCourse,
  undoAcademicCommand,
  updateCourse,
} from "../server/academic/functions";
import { requireAuthenticatedRoute } from "../server/auth/functions";

const searchSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  lifecycle: z
    .enum(["current", "archived", "all"])
    .optional()
    .catch("current"),
});

export const Route = createFileRoute("/courses")({
  beforeLoad: requireAuthenticatedRoute,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const lifecycle = deps.lifecycle ?? "current";
    const [result, allResult] = await Promise.all([
      listCourses({ data: lifecycle }),
      lifecycle === "all"
        ? Promise.resolve(undefined)
        : listCourses({ data: "all" }),
    ]);
    const courses = isCourseList(result) ? result : [];
    const allCourses = isCourseList(allResult) ? allResult : courses;

    return { courses, hasCourses: allCourses.length > 0 };
  },
  pendingComponent: () => <AcademicLoading title="Courses" />,
  errorComponent: ({ reset }) => (
    <AcademicError title="Courses unavailable" reset={reset} />
  ),
  component: CoursesRoute,
});

function CoursesRoute() {
  const { courses, hasCourses } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course>();
  const [deletingCourse, setDeletingCourse] = useState<Course>();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<ReadonlyArray<AcademicFieldError>>([]);
  const [notice, setNotice] = useState<{
    readonly message: string;
    readonly token?: string;
  }>();
  const [queryInput, setQueryInput] = useState(search.q ?? "");
  const [lifecycleInput, setLifecycleInput] = useState(search.lifecycle ?? "current");

  useEffect(() => {
    const stored = sessionStorage.getItem("kairo.academic.notice");
    if (!stored) return;
    sessionStorage.removeItem("kairo.academic.notice");
    try {
      const value: unknown = JSON.parse(stored);
      if (
        value &&
        typeof value === "object" &&
        "message" in value &&
        typeof value.message === "string"
      ) {
        const token = Reflect.get(value, "token");
        setNotice({
          message: value.message,
          ...(typeof token === "string" ? { token } : {}),
        });
      }
    } catch {
      // Ignore stale route feedback.
    }
  }, []);

  const query = queryInput.trim().toLocaleLowerCase();
  const visible = courses.filter(
    (course) =>
      !query ||
      course.title.toLocaleLowerCase().includes(query) ||
      course.code?.toLocaleLowerCase().includes(query),
  );
  const noMatches = hasCourses && visible.length === 0;

  const create = async (values: CourseFormValues) => {
    setPending(true);
    setErrors([]);
    try {
      const result = await createCourse({ data: values });
      if (result._tag === "invalid") {
        setErrors(result.fields);
      } else if (
        (result._tag === "applied" || result._tag === "already_applied") &&
        result.value
      ) {
        setOpen(false);
        sessionStorage.setItem(
          "kairo.academic.notice",
          JSON.stringify({
            message: "Course created.",
            token: result.undoToken,
          }),
        );
        await navigate({
          to: "/courses/$courseId",
          params: { courseId: result.value.id },
        });
      } else {
        setErrors([
          {
            field: "form",
            message: "The course could not be created. Retry when ready.",
          },
        ]);
      }
    } finally {
      setPending(false);
    }
  };

  const undo = async () => {
    if (!notice?.token) return;
    const result = await undoAcademicCommand({
      data: { token: notice.token, idempotencyKey: crypto.randomUUID() },
    });
    setNotice({
      message:
        result._tag === "applied"
          ? "Change undone."
          : "This change can no longer be undone. Reload to see current data.",
    });
    if (result._tag === "applied") {
      startTransition(() => void router.invalidate());
    }
  };

  const update = async (values: CourseFormValues) => {
    if (!editingCourse) return;
    setPending(true);
    setErrors([]);
    try {
      const result = await updateCourse({
        data: {
          courseId: editingCourse.id,
          expectedVersion: editingCourse.version,
          patch: { title: values.title, code: values.code },
          idempotencyKey: values.idempotencyKey,
        },
      });
      if (result._tag === "invalid") {
        setErrors(result.fields);
      } else if (result._tag === "conflict") {
        setErrors([
          {
            field: "form",
            message:
              "This course changed. Reload to see the current values; your edits remain here.",
          },
        ]);
      } else if (
        result._tag === "applied" ||
        result._tag === "already_applied"
      ) {
        setEditingCourse(undefined);
        setNotice({ message: "Course updated.", token: result.undoToken });
        startTransition(() => void router.invalidate());
      } else {
        setErrors([{ field: "form", message: "The course could not be saved." }]);
      }
    } finally {
      setPending(false);
    }
  };

  const changeLifecycle = async (course: Course) => {
    setPending(true);
    try {
      const command = course.lifecycle === "current" ? archiveCourse : reopenCourse;
      const result = await command({
        data: {
          courseId: course.id,
          expectedVersion: course.version,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      if (result._tag === "applied" || result._tag === "already_applied") {
        setNotice({
          message: course.lifecycle === "current" ? "Course archived." : "Course restored.",
          token: result.undoToken,
        });
        startTransition(() => void router.invalidate());
      } else {
        setNotice({
          message:
            result._tag === "conflict"
              ? "This course changed. Reload before trying again."
              : "The course could not be changed.",
        });
      }
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    if (!deletingCourse) return;
    setPending(true);
    try {
      const result = await deleteCourse({
        data: {
          courseId: deletingCourse.id,
          expectedVersion: deletingCourse.version,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      if (result._tag === "applied" || result._tag === "already_applied") {
        setDeletingCourse(undefined);
        setNotice({ message: "Course deleted.", token: result.undoToken });
        startTransition(() => void router.invalidate());
      } else {
        setNotice({
          message:
            result._tag === "conflict" && result.reason === "has_dependents"
              ? "Move or delete linked work before deleting this course."
              : "The course could not be deleted.",
        });
      }
    } finally {
      setPending(false);
    }
  };

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = String(
      new FormData(event.currentTarget).get("q") ?? "",
    ).trim();
    setQueryInput(q);
    void navigate({
      search: (previous) => ({ ...previous, q: q || undefined }),
      replace: true,
    });
  };

  return (
    <AcademicShell>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 pb-24 sm:px-6 md:py-12 lg:px-10">
        <header className="flex items-start justify-between gap-5">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-kumo-base text-kumo-brand shadow-sm ring ring-kumo-line">
              <Books aria-hidden="true" size={21} weight="regular" />
            </span>
            <div className="min-w-0">
              <Text as="h1" variant="heading1">
                Courses
              </Text>
              <div className="mt-1 text-sm text-kumo-subtle tabular-nums">
                {visible.length} {visible.length === 1 ? "course" : "courses"}
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
                  Create course
                </Button>
              )}
            />
            <Dialog className="max-h-[calc(100svh-2rem)] overflow-y-auto p-5 sm:max-w-xl sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <Dialog.Title className="text-xl font-semibold">
                  Create course
                </Dialog.Title>
                <Dialog.Close
                  aria-label="Close create course"
                  render={(props) => (
                    <Button
                      {...props}
                      title="Close create course"
                      variant="secondary"
                      shape="square"
                      className="min-h-10 min-w-10"
                      icon={<X aria-hidden="true" size={18} />}
                    />
                  )}
                />
              </div>
              <CourseForm
                errors={errors}
                pending={pending}
                onCancel={() => setOpen(false)}
                onSubmit={create}
              />
            </Dialog>
          </Dialog.Root>
        </header>

        <section className="mt-9" aria-labelledby="course-library-heading">
          <div className="mb-3 flex items-center justify-between px-1">
            <Text as="h2" variant="heading3" id="course-library-heading">
              Course library
            </Text>
            <span className="hidden text-xs text-kumo-subtle sm:inline">
              Updated courses appear first
            </span>
          </div>

          <LayerCard className="rounded-2xl">
            <LayerCard.Primary className="flex flex-col gap-3 rounded-[15px] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <form
                onSubmit={submitSearch}
                role="search"
                className="min-w-0 flex-1 sm:max-w-md"
              >
                <label htmlFor="course-search" className="sr-only">
                  Search courses
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
                    id="course-search"
                    name="q"
                    type="search"
                    value={queryInput}
                    onChange={(event) => setQueryInput(event.target.value)}
                    placeholder="Search courses"
                  />
                </InputGroup>
                <button type="submit" className="sr-only">
                  Search
                </button>
              </form>
              <Select
                aria-label="Course state"
                size="lg"
                value={lifecycleInput}
                onValueChange={(lifecycle) => {
                  if (lifecycle === null) return;
                  setLifecycleInput(lifecycle);
                  void navigate({
                    search: (previous) => ({ ...previous, lifecycle }),
                  });
                }}
                items={{
                  current: "Current courses",
                  archived: "Archived courses",
                  all: "All courses",
                }}
                className="w-full shrink-0 sm:w-44"
              />
            </LayerCard.Primary>
          </LayerCard>

          {visible.length === 0 ? (
            <LayerCard className="mt-4 rounded-2xl">
              <Empty
                size="base"
                icon={
                  noMatches ? (
                    <span className="flex size-12 items-center justify-center rounded-xl bg-kumo-tint text-kumo-subtle ring ring-kumo-line">
                      <MagnifyingGlass aria-hidden="true" size={23} />
                    </span>
                  ) : (
                    <span className="flex size-12 items-center justify-center rounded-xl bg-kumo-brand text-kumo-inverse shadow-sm">
                      <BookOpen aria-hidden="true" size={23} />
                    </span>
                  )
                }
                title={noMatches ? "No matching courses" : "No courses yet"}
                contents={
                  noMatches ? (
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
                      Create course
                    </Button>
                  )
                }
              />
            </LayerCard>
          ) : (
            <ol className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
              {visible.map((course, index) => (
                <CourseFolio
                  key={course.id}
                  course={course}
                  index={index + 1}
                  pending={pending}
                  onEdit={setEditingCourse}
                  onLifecycle={changeLifecycle}
                  onDelete={setDeletingCourse}
                />
              ))}
            </ol>
          )}
        </section>
      </main>
      <Dialog.Root
        open={Boolean(editingCourse)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setEditingCourse(undefined);
        }}
      >
        <Dialog className="p-5 sm:max-w-xl sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title className="text-xl font-semibold">Edit course</Dialog.Title>
            <Dialog.Close
              aria-label="Close edit course"
              render={(props) => (
                <Button
                  {...props}
                  title="Close edit course"
                  variant="secondary"
                  shape="square"
                  icon={<X aria-hidden="true" size={18} />}
                />
              )}
            />
          </div>
          <CourseForm
            course={editingCourse}
            errors={errors}
            pending={pending}
            onCancel={() => setEditingCourse(undefined)}
            onSubmit={update}
          />
        </Dialog>
      </Dialog.Root>
      <Dialog.Root
        open={Boolean(deletingCourse)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeletingCourse(undefined);
        }}
      >
        <Dialog className="p-5 sm:max-w-md sm:p-6">
          <WarningCircle aria-hidden="true" size={24} className="text-kumo-danger" />
          <Dialog.Title className="mt-3 text-xl font-semibold">
            Delete {deletingCourse?.title ?? "course"}?
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-kumo-subtle">
            The course will be removed from academic routes.
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeletingCourse(undefined)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={pending} onClick={() => void remove()}>
              Delete course
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>
      {notice ? (
        <AcademicToast
          message={notice.message}
          undoToken={notice.token}
          pending={pending}
          onUndo={() => void undo()}
        />
      ) : null}
    </AcademicShell>
  );
}

function CourseFolio({
  course,
  index,
  pending,
  onEdit,
  onLifecycle,
  onDelete,
}: {
  readonly course: Course;
  readonly index: number;
  readonly pending: boolean;
  readonly onEdit: (course: Course) => void;
  readonly onLifecycle: (course: Course) => Promise<void>;
  readonly onDelete: (course: Course) => void;
}) {
  const folioNumber = String(index).padStart(2, "0");

  return (
    <li className="min-w-0">
        <LayerCard className="group h-full shadow-sm hover:shadow-md">
          <LayerCard.Secondary className="justify-between gap-3 px-4 py-2.5">
            <span className="flex min-w-0 items-center gap-2 text-xs text-kumo-subtle">
              <span className="font-medium tabular-nums text-kumo-brand">
                {folioNumber}
              </span>
              <span aria-hidden="true" className="h-3 w-px bg-kumo-line" />
              <span className="truncate font-medium">
                {course.code ?? "Course"}
              </span>
            </span>
            {course.lifecycle === "archived" ? (
              <Badge variant="secondary">Archived</Badge>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-kumo-subtle">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-kumo-success"
                />
                Current
              </span>
            )}
          </LayerCard.Secondary>
          <LayerCard.Primary className="min-h-36 justify-between gap-8 px-5 py-4 sm:min-h-40">
            <div className="flex items-start justify-between gap-4">
              <div className="text-pretty">
                <Text as="h3" variant="heading2">
                  {course.title}
                </Text>
              </div>
              <DropdownMenu>
                <DropdownMenu.Trigger
                  aria-label={`Actions for ${course.title}`}
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus active:scale-[0.96]"
                >
                  <DotsThree aria-hidden="true" size={18} />
                </DropdownMenu.Trigger>
                <DropdownMenu.Content className="origin-[var(--transform-origin)] transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0 motion-reduce:transform-none">
                  <DropdownMenu.Item
                    icon={<PencilSimple aria-hidden="true" className="mr-2 size-4" />}
                    onClick={() => onEdit(course)}
                  >
                    Edit
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    disabled={pending}
                    icon={<Archive aria-hidden="true" className="mr-2 size-4" />}
                    onClick={() => void onLifecycle(course)}
                  >
                    {course.lifecycle === "current" ? "Archive" : "Restore"}
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item
                    variant="danger"
                    icon={<Trash aria-hidden="true" className="mr-2 size-4" />}
                    onClick={() => onDelete(course)}
                  >
                    Delete
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu>
            </div>
            <span className="flex items-center gap-2 text-xs text-kumo-subtle">
              <BookOpen aria-hidden="true" size={15} />
              Updated {formatCourseDate(course.updatedAt)}
            </span>
          </LayerCard.Primary>
        </LayerCard>
    </li>
  );
}

function formatCourseDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function isCourseList(value: unknown): value is ReadonlyArray<Course> {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" && item !== null && "lifecycle" in item,
    )
  );
}
