import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { CalendarCheck, CalendarDots, FrameCorners, List, ListChecks, NoteBlank, Timer, X } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

const routes = [
  { to: "/canvas", label: "Canvas", icon: FrameCorners },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/timetable", label: "Timetable", icon: CalendarDots },
  { to: "/deadlines", label: "Deadlines", icon: CalendarCheck },
  { to: "/notes", label: "Notes", icon: NoteBlank },
  { to: "/focus", label: "Focus", icon: Timer },
] as const;

/** Quiet Rail shell used by production Notes routes. */
export function NoteShell({ children }: { readonly children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="min-h-screen bg-kumo-canvas text-kumo-default">
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r border-kumo-line px-3 py-4 md:flex">
          <Link to="/canvas" className="flex h-12 items-center px-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus">
            <img src="/brand/kairo-primary.svg" alt="Kairo" className="h-7 w-auto" />
          </Link>
          <nav aria-label="Workspace routes" className="mt-5 grid gap-1">
            <p className="px-3 pb-1 text-xs font-medium text-kumo-subtle">Your work</p>
            {routes.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} activeProps={{ "aria-current": "page", className: "bg-kumo-base text-kumo-strong shadow-xs ring ring-kumo-line" }} inactiveProps={{ className: "text-kumo-default hover:bg-kumo-tint" }} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus">
                <Icon aria-hidden="true" size={18} className="shrink-0" />{label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex min-h-14 items-center border-b border-kumo-line bg-kumo-canvas/95 px-4 backdrop-blur md:hidden">
            <Link to="/canvas" className="shrink-0"><img src="/brand/kairo-primary.svg" alt="Kairo" className="h-6 w-auto" /></Link>
            <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
              <Dialog.Trigger render={(props) => <Button {...props} title="Open navigation" variant="secondary" className="ms-auto" icon={<List aria-hidden="true" size={18} />}>Menu</Button>} />
              <Dialog className="inset-y-2 end-2 start-auto m-0 flex h-[calc(100svh-1rem)] w-[min(22rem,calc(100vw-1rem))] translate-x-0 translate-y-0 flex-col rounded-xl p-4">
                <div className="flex items-center justify-between gap-4"><Dialog.Title className="text-lg font-semibold">Navigation</Dialog.Title><Dialog.Close aria-label="Close navigation" render={(props) => <Button {...props} title="Close navigation" variant="secondary" shape="square" icon={<X aria-hidden="true" size={18} />} />} /></div>
                <nav aria-label="Mobile workspace routes" className="mt-5 grid gap-1 overflow-y-auto">
                  {routes.map(({ to, label, icon: Icon }) => <Link key={to} to={to} onClick={() => setMenuOpen(false)} activeProps={{ "aria-current": "page", className: "bg-kumo-base text-kumo-strong shadow-xs ring ring-kumo-line" }} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-kumo-default hover:bg-kumo-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus"><Icon aria-hidden="true" size={18} />{label}</Link>)}
                </nav>
              </Dialog>
            </Dialog.Root>
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}
