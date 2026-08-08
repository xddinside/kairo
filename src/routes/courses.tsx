import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Books, MagnifyingGlass, Plus, X } from "@phosphor-icons/react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { startTransition, useEffect, useState } from "react";
import { z } from "zod";

import { AcademicError, AcademicLoading, AcademicToast } from "../components/academic/academic-feedback";
import { AcademicShell } from "../components/academic/academic-shell";
import { CourseForm, type CourseFormValues } from "../components/academic/course-form";
import { createCourse, listCourses, undoAcademicCommand } from "../server/academic/functions";
import type { AcademicFieldError, Course } from "../server/academic/domain";
import { requireAuthenticatedRoute } from "../server/auth/functions";

const searchSchema = z.object({ q: z.string().max(100).optional().catch(undefined), lifecycle: z.enum(["current", "archived", "all"]).optional().catch("current") });

export const Route = createFileRoute("/courses")({
  beforeLoad: requireAuthenticatedRoute,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => { const result = await listCourses({ data: deps.lifecycle ?? "current" }); return isCourseList(result) ? result : []; },
  pendingComponent: () => <AcademicLoading title="Courses" />,
  errorComponent: ({ reset }) => <AcademicError title="Courses unavailable" reset={reset} />,
  component: CoursesRoute,
});

function CoursesRoute() {
  const courses = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<ReadonlyArray<AcademicFieldError>>([]);
  const [notice, setNotice] = useState<{ readonly message: string; readonly token?: string }>();
  useEffect(() => { const stored = sessionStorage.getItem("kairo.academic.notice"); if (!stored) return; sessionStorage.removeItem("kairo.academic.notice"); try { const value: unknown = JSON.parse(stored); if (value && typeof value === "object" && "message" in value && typeof value.message === "string") { const token = Reflect.get(value, "token"); setNotice({ message: value.message, ...(typeof token === "string" ? { token } : {}) }); } } catch { /* Ignore stale route feedback. */ } }, []);
  const query = search.q?.trim().toLocaleLowerCase() ?? "";
  const visible = courses.filter((course) => !query || course.title.toLocaleLowerCase().includes(query) || course.code?.toLocaleLowerCase().includes(query));
  const create = async (values: CourseFormValues) => { setPending(true); setErrors([]); try { const result = await createCourse({ data: values }); if (result._tag === "invalid") setErrors(result.fields); else if ((result._tag === "applied" || result._tag === "already_applied") && result.value) { setOpen(false); sessionStorage.setItem("kairo.academic.notice", JSON.stringify({ message: "Course created.", token: result.undoToken })); await navigate({ to: "/courses/$courseId", params: { courseId: result.value.id } }); } else setErrors([{ field: "form", message: "The course could not be created. Retry when ready." }]); } finally { setPending(false); } };
  const undo = async () => { if (!notice?.token) return; const result = await undoAcademicCommand({ data: { token: notice.token, idempotencyKey: crypto.randomUUID() } }); setNotice({ message: result._tag === "applied" ? "Change undone." : "This change can no longer be undone. Reload to see current data." }); if (result._tag === "applied") startTransition(() => void router.invalidate()); };
  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const q = String(new FormData(event.currentTarget).get("q") ?? "").trim(); void navigate({ search: (previous) => ({ ...previous, q: q || undefined }), replace: true }); };
  const filtered = Boolean(query || search.lifecycle !== "current");
  return <AcademicShell><main className="mx-auto w-full max-w-5xl px-4 py-6 pb-24 sm:px-6 md:py-8 lg:px-10">
    <div className="flex flex-wrap items-end justify-between gap-4"><h1 className="text-2xl font-semibold text-kumo-strong">Courses</h1><Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Trigger render={(props) => <Button {...props} icon={<Plus aria-hidden="true" size={16} />} className="min-h-11 transition-transform duration-150 ease-out active:scale-[0.96]">Create course</Button>} /><Dialog className="max-h-[calc(100svh-2rem)] overflow-y-auto p-5 sm:max-w-xl sm:p-6"><div className="mb-5 flex items-center justify-between"><Dialog.Title className="text-xl font-semibold">Create course</Dialog.Title><Dialog.Close aria-label="Close create course" render={(props) => <Button {...props} title="Close create course" variant="secondary" shape="square" className="min-h-11 min-w-11" icon={<X aria-hidden="true" size={18} />} />} /></div><CourseForm errors={errors} pending={pending} onCancel={() => setOpen(false)} onSubmit={create} /></Dialog></Dialog.Root></div>
    <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]"><form onSubmit={submitSearch} className="flex gap-2"><label htmlFor="course-search" className="sr-only">Search courses</label><Input id="course-search" name="q" type="search" defaultValue={search.q ?? ""} placeholder="Search courses" className="text-base sm:text-sm" /><Button type="submit" variant="secondary" shape="square" className="min-h-11 min-w-11" aria-label="Search courses" icon={<MagnifyingGlass aria-hidden="true" size={18} />} /></form><label className="grid gap-1 text-sm font-medium"><span className="sr-only">Course state</span><select value={search.lifecycle ?? "current"} onChange={(event) => void navigate({ search: (previous) => ({ ...previous, lifecycle: event.target.value as "current" | "archived" | "all" }) })} className="min-h-11 rounded-lg bg-kumo-base px-3 text-base ring ring-kumo-line sm:text-sm"><option value="current">Current</option><option value="archived">Archived</option><option value="all">All courses</option></select></label></div>
    <p role="status" className="mt-5 text-sm text-kumo-subtle">{visible.length} {visible.length === 1 ? "course" : "courses"}</p>
    {visible.length === 0 ? <LayerCard className="mt-5 px-6 py-10 text-center"><Books aria-hidden="true" size={28} className="mx-auto text-kumo-subtle" /><h2 className="mt-3 text-lg font-semibold">{filtered ? "No courses match these filters" : "No courses yet"}</h2><div className="mt-5 flex justify-center gap-2">{filtered ? <Button variant="secondary" onClick={() => void navigate({ search: {} })}>Clear filters</Button> : null}<Button onClick={() => setOpen(true)}>Create course</Button></div></LayerCard> : <LayerCard className="mt-5"><ul className="divide-y divide-kumo-line">{visible.map((course) => <li key={course.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5"><div className="min-w-0"><Link to="/courses/$courseId" params={{ courseId: course.id }} className="text-sm font-medium text-kumo-strong underline-offset-4 hover:underline">{course.title}</Link><div className="mt-1 flex items-center gap-2 text-xs text-kumo-subtle">{course.code ? <span>{course.code}</span> : null}<Badge variant="secondary">{course.lifecycle}</Badge></div></div><Link to="/courses/$courseId" params={{ courseId: course.id }} className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-kumo-brand ring ring-kumo-line hover:bg-kumo-tint">View</Link></li>)}</ul></LayerCard>}
  </main>{notice ? <AcademicToast message={notice.message} undoToken={notice.token} pending={pending} onUndo={() => void undo()} /> : null}</AcademicShell>;
}

function isCourseList(value: unknown): value is ReadonlyArray<Course> { return Array.isArray(value) && value.every((item) => typeof item === "object" && item !== null && "lifecycle" in item); }
