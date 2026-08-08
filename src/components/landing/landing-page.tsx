import { useAuth } from "@clerk/tanstack-react-start";
import type { ComponentPropsWithoutRef } from "react";

import { PromptDemo } from "./prompt-demo";
import { Reveal } from "./reveal";
import { Spark, SparkDoodle } from "./spark";
import {
  DeadlinesMock,
  NotesMock,
  TasksMock,
  TimetableMock,
} from "./block-mocks";

function AppLink({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"a">) {
  const { isLoaded, isSignedIn } = useAuth();
  const href = isLoaded && isSignedIn ? "/canvas" : "/sign-in";

  return (
    <a {...props} href={href} className={className}>
      {children}
    </a>
  );
}

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`group inline-flex ${className}`}>
      <img
        src="/brand/kairo-primary.svg"
        alt="Kairo"
        className="h-7 w-auto transition-opacity duration-300 group-hover:opacity-80"
      />
    </span>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-kumo-line bg-white/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <a href="#top" aria-label="Kairo — back to top" className="btn-press block">
          <Wordmark />
        </a>
        <div className="hidden items-center gap-8 text-sm font-medium text-kumo-subtle md:flex">
          <a href="#beats" className="link-underline transition-colors hover:text-kumo-strong">
            How it works
          </a>
          <a href="#blocks" className="link-underline transition-colors hover:text-kumo-strong">
            The blocks
          </a>
          <a href="#name" className="link-underline transition-colors hover:text-kumo-strong">
            The name
          </a>
          <a href="#students" className="link-underline transition-colors hover:text-kumo-strong">
            Students
          </a>
        </div>
        <AppLink
          className="btn-primary inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium"
        >
          Open the canvas
        </AppLink>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="grid-lines absolute inset-x-0 top-0 h-[640px]" />
        <div className="absolute left-1/2 top-56 h-96 w-[720px] -translate-x-1/2 rounded-full bg-kumo-brand/10 blur-3xl" />
        <Spark
          strokeWidth={4}
          className="absolute left-[8%] top-44 hidden size-7 animate-spin-slower text-kumo-brand/20 lg:block"
        />
        <Spark
          strokeWidth={4}
          className="absolute right-[11%] top-64 hidden size-5 animate-spin-ghost text-kumo-brand/20 lg:block"
        />
        <SparkDoodle className="absolute left-[13%] top-[440px] hidden size-4 text-kumo-inactive lg:block" />
        <SparkDoodle className="absolute right-[7%] top-[480px] hidden size-4 text-kumo-inactive lg:block" />
      </div>

      <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center px-5 pt-20 pb-24 text-center sm:px-8 sm:pt-28 sm:pb-32">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-lg border border-kumo-line bg-white px-3.5 py-1.5 text-xs font-medium text-kumo-subtle">
            <span aria-hidden="true" className="size-1.5 animate-pulse-dot rounded-full bg-kumo-brand" />
            For students who’d rather do the work than fight the app
          </span>
        </Reveal>

        <Reveal delay={90}>
          <h1 className="mt-8 max-w-3xl text-balance text-4xl font-bold leading-[1.08] tracking-tight text-kumo-strong sm:text-6xl md:text-[4.25rem]">
            A workspace shaped around{" "}
            <em className="bg-gradient-to-r from-kumo-brand to-kumo-brand-hover bg-clip-text font-serif font-medium italic text-transparent">
              what matters now.
            </em>
          </h1>
        </Reveal>

        <Reveal delay={180}>
          <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-kumo-subtle sm:text-lg">
            Tell Kairo what you’re up against — an essay, a quiz, a whole week of
            deadlines — and it composes a calm workspace around exactly that.
            No setup. No widget-wrestling. Just the work, right when you need it.
          </p>
        </Reveal>

        <Reveal delay={270} className="mt-14 w-full max-w-2xl">
          <PromptDemo />
        </Reveal>

        <Reveal delay={360}>
          <p className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm font-medium text-kumo-inactive">
            <span>Free for students</span>
            <Spark strokeWidth={5} className="size-3 text-kumo-brand/40" aria-hidden="true" />
            <span>Ready in ten seconds</span>
            <Spark strokeWidth={5} className="size-3 text-kumo-brand/40" aria-hidden="true" />
            <span>Works in your browser</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function Beats() {
  const beats = [
    {
      n: "01",
      title: "Tell it",
      body: "Type what you need in plain words. “Essay due Friday” is enough. Kairo reads intent, not keywords.",
      doodle: (
        <svg viewBox="0 0 64 64" className="size-10" aria-hidden="true">
          <rect x="4" y="22" width="56" height="20" rx="10" fill="none" stroke="currentColor" strokeWidth="4" />
          <path d="M14 32h22" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <path d="M48 26v12M42 32h12" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      n: "02",
      title: "It builds",
      body: "Your canvas composes itself from calm, proven blocks — deadlines, notes, next steps. The clutter never makes it in.",
      doodle: (
        <svg viewBox="0 0 64 64" className="size-10" aria-hidden="true">
          <rect x="14" y="6" width="36" height="14" rx="7" fill="currentColor" opacity="0.4" />
          <rect x="8" y="25" width="48" height="14" rx="7" fill="currentColor" />
          <rect x="14" y="44" width="36" height="14" rx="7" fill="currentColor" opacity="0.7" />
        </svg>
      ),
    },
    {
      n: "03",
      title: "You do the work",
      body: "Focus on the thing in front of you. The canvas stays quiet, present — and reshapes as your day actually goes.",
      doodle: (
        <svg viewBox="0 0 64 64" className="size-10" aria-hidden="true">
          <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth="4" />
          <path d="M22 33l7 7 14-16" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      ),
    },
  ];

  return (
    <section id="beats" className="mx-auto w-full max-w-6xl scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
      <Reveal className="text-center">
        <p className="eyebrow text-kumo-subtle">How it works</p>
        <h2 className="mx-auto mt-4 max-w-2xl text-balance text-3xl font-bold tracking-tight text-kumo-strong sm:text-5xl">
          From chaos to canvas,{" "}
          <em className="font-serif font-medium italic">in three beats</em>.
        </h2>
      </Reveal>

      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {beats.map((beat, i) => (
          <Reveal key={beat.n} delay={i * 110}>
            <div className="surface card-lift group h-full rounded-2xl p-7">
              <span className="flex size-12 items-center justify-center rounded-lg bg-kumo-tint text-kumo-strong transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:scale-[1.05]">
                {beat.doodle}
              </span>
              <p className="mt-6 font-serif text-sm italic text-kumo-inactive transition-colors duration-300 group-hover:text-kumo-brand/70">
                {beat.n}
              </p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-kumo-strong">
                {beat.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-kumo-subtle">{beat.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Blocks() {
  const cards = [
    {
      title: "Tasks",
      copy: "A to-do list that knows your deadlines.",
      mock: <TasksMock />,
      span: "lg:col-span-2 lg:row-span-2",
      pad: "p-7 sm:p-8",
    },
    {
      title: "Timetable",
      copy: "Your week at a glance, without the grid-lock.",
      mock: <TimetableMock />,
      span: "lg:col-span-2",
      pad: "p-6",
    },
    {
      title: "Deadlines",
      copy: "Countdowns that feel like support, not sirens.",
      mock: <DeadlinesMock />,
      span: "lg:col-span-2",
      pad: "p-6",
    },
    {
      title: "Notes",
      copy: "Thoughts that stay where you left them.",
      mock: <NotesMock />,
      span: "lg:col-span-3",
      pad: "p-6 sm:p-7",
    },
  ];

  return (
    <section id="blocks" className="mx-auto w-full max-w-6xl scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
      <Reveal>
        <p className="eyebrow text-kumo-subtle">The blocks</p>
        <h2 className="mt-4 max-w-2xl text-balance text-3xl font-bold tracking-tight text-kumo-strong sm:text-5xl">
          Four calm blocks. <em className="font-serif font-medium italic">One clear day.</em>
        </h2>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-kumo-subtle sm:text-lg">
          Kairo composes every canvas from a small set of proven blocks — the
          same ones students keep coming back to. No widget graveyard, ever.
        </p>
      </Reveal>

      <div className="mt-14 grid gap-5 lg:grid-cols-6">
        {cards.map((card, i) => (
          <Reveal key={card.title} delay={i * 90} className={card.span}>
            <div className="surface card-lift group h-full rounded-2xl">
              <div className={`flex h-full flex-col justify-between gap-6 ${card.pad}`}>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-kumo-strong">
                    {card.title}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-kumo-subtle">{card.copy}</p>
                </div>
                <div className="rounded-xl bg-kumo-elevated p-4 transition-colors duration-300 group-hover:bg-kumo-tint">
                  {card.mock}
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function NameStory() {
  const stars = [
    { top: "12%", left: "8%", size: 6 },
    { top: "24%", left: "17%", size: 4 },
    { top: "10%", left: "58%", size: 5 },
    { top: "18%", left: "88%", size: 6 },
    { top: "36%", left: "76%", size: 4 },
    { top: "44%", left: "6%", size: 4 },
    { top: "58%", left: "12%", size: 6 },
    { top: "50%", left: "90%", size: 5 },
    { top: "66%", left: "80%", size: 4 },
    { top: "74%", left: "10%", size: 5 },
    { top: "80%", left: "52%", size: 4 },
    { top: "76%", left: "92%", size: 6 },
  ];

  return (
    <section id="name" className="mx-auto w-full max-w-6xl scroll-mt-24 px-5 py-10 sm:px-8 sm:py-16">
      <Reveal>
        <div className="relative overflow-hidden rounded-2xl bg-kumo-contrast px-6 py-20 text-center sm:px-12 sm:py-28">
          <div aria-hidden="true" className="glow-brand pointer-events-none absolute inset-0" />
          <Spark
            strokeWidth={3}
            className="absolute -top-20 -right-20 size-72 animate-spin-ghost text-kumo-brand/15"
            aria-hidden="true"
          />
          <Spark
            strokeWidth={3}
            className="absolute -bottom-24 -left-16 size-56 animate-spin-slower text-kumo-brand/15"
            aria-hidden="true"
          />
          {stars.map((star, i) => (
            <SparkDoodle
              key={i}
              className="absolute hidden text-kumo-brand/25 sm:block"
              style={{
                top: star.top,
                left: star.left,
                width: star.size,
                height: star.size,
              }}
            />
          ))}

          <div className="relative mx-auto max-w-2xl">
            <p className="eyebrow text-kumo-subtle">The name</p>
            <p className="mt-6 font-serif text-3xl font-medium italic leading-snug text-kumo-inverse sm:text-5xl">
              Kairos — καιρός — the ancient Greek word for{" "}
              <span className="text-kumo-brand">the right moment to act</span>.
            </p>
            <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-kumo-inverse/70 sm:text-lg">
              Not the clock’s moment. Yours: when the work is due, when you’re
              actually awake, when half an hour is all it takes. Kairo finds
              those moments and puts the right work in them. Chronos is the
              ticking clock. Kairo is when you answer it.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Students() {
  const quotes = [
    {
      text: "I typed “essay due friday” and it just built it. I sat there for a second.",
      name: "Mira",
      detail: "Second-year CompSci",
    },
    {
      text: "The only app that ever made my deadlines feel smaller instead of louder.",
      name: "Theo",
      detail: "First-year Design",
    },
    {
      text: "My week was one long panic. Now it’s a canvas I can actually look at.",
      name: "Aisha",
      detail: "Third-year Economics",
    },
  ];

  return (
    <section id="students" className="mx-auto w-full max-w-6xl scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
      <Reveal className="text-center">
        <p className="eyebrow text-kumo-subtle">Students</p>
        <h2 className="mx-auto mt-4 max-w-2xl text-balance text-3xl font-bold tracking-tight text-kumo-strong sm:text-5xl">
          Said <em className="font-serif font-medium italic">between classes</em>.
        </h2>
      </Reveal>

      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {quotes.map((quote, i) => (
          <Reveal key={quote.name} delay={i * 110}>
            <div className="surface card-lift group h-full rounded-2xl p-7">
              <p
                aria-hidden="true"
                className="font-serif text-4xl leading-none text-kumo-inactive transition-colors duration-300 group-hover:text-kumo-brand/70"
              >
                “
              </p>
              <p className="mt-2 font-serif text-xl italic leading-snug text-kumo-strong">
                {quote.text}
              </p>
              <footer className="mt-6">
                <p className="text-sm font-semibold tracking-tight text-kumo-strong">
                  {quote.name}
                </p>
                <p className="mt-0.5 text-xs font-medium text-kumo-subtle">{quote.detail}</p>
              </footer>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="mx-auto w-full max-w-4xl px-5 pb-24 sm:px-8 sm:pb-32">
      <Reveal>
        <div className="surface relative overflow-hidden rounded-2xl px-6 py-20 text-center sm:py-24">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-8 -top-24 h-64 rounded-full bg-kumo-brand/10 blur-3xl" />
            <Spark
              strokeWidth={4}
              className="absolute top-10 left-[14%] size-6 animate-spin-ghost text-kumo-brand/25"
            />
            <Spark
              strokeWidth={4}
              className="absolute right-[14%] top-16 size-4 animate-spin-slower text-kumo-brand/25"
            />
          </div>

          <div className="relative">
            <img
              src="/brand/kairo-icon.svg"
              alt=""
              className="mx-auto size-10"
              aria-hidden="true"
            />
            <h2 className="mt-6 text-balance text-4xl font-bold tracking-tight text-kumo-strong sm:text-5xl">
              Find your <em className="font-serif font-medium italic">moment</em>.
            </h2>
            <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-kumo-subtle">
              Free for students. Ready in ten seconds. It starts with one sentence.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <AppLink
                className="btn-primary group inline-flex h-11 items-center gap-2 rounded-lg px-6 text-base font-medium"
              >
                Open your canvas
                <svg
                  viewBox="0 0 24 24"
                  className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5"
                  aria-hidden="true"
                >
                  <path
                    d="M5 12h14M13 6l6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </AppLink>
              <a
                href="#beats"
                className="btn-press inline-flex h-11 items-center rounded-lg border border-kumo-line bg-white px-6 text-base font-medium text-kumo-default transition-colors hover:bg-kumo-tint"
              >
                See how it works
              </a>
            </div>
            <p className="mt-6 text-xs font-medium text-kumo-inactive">
              Works in your browser · No credit card · Your data stays yours
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  const columns = [
    {
      title: "Workspace",
      links: ["Canvas", "Today", "Tasks", "Timetable", "Deadlines", "Notes"],
    },
    {
      title: "The page",
      links: [
        { label: "How it works", href: "#beats" },
        { label: "The blocks", href: "#blocks" },
        { label: "The name", href: "#name" },
        { label: "Students", href: "#students" },
      ],
    },
  ];

  return (
    <footer className="border-t border-kumo-line bg-kumo-elevated">
      <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-kumo-subtle">
              Made for the moment between classes.
            </p>
          </div>
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="eyebrow text-kumo-inactive">{column.title}</p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => {
                  const href = typeof link === "string" ? undefined : link.href;
                  const label = typeof link === "string" ? link : link.label;
                  return (
                    <li key={label}>
                      {typeof link === "string" ? (
                        <AppLink
                          className="link-underline text-sm font-medium text-kumo-subtle transition-colors hover:text-kumo-strong"
                        >
                          {label}
                        </AppLink>
                      ) : (
                        <a
                          href={href}
                          className="link-underline text-sm font-medium text-kumo-subtle transition-colors hover:text-kumo-strong"
                        >
                          {label}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>
          ))}
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none mt-16 select-none overflow-hidden text-center"
        >
          <span className="block text-[clamp(4rem,16vw,14rem)] leading-[0.85] font-bold tracking-tighter text-kumo-strong/[0.045]">
            Kairo
          </span>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-kumo-line pt-6 sm:flex-row">
          <p className="text-xs font-medium text-kumo-inactive">
            © 2026 Kairo · made with care, for students
          </p>
          <p className="text-xs font-medium text-kumo-inactive">
            Set in DM Sans, with one serif friend
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-kumo-canvas text-kumo-default">
      <div className="grain" aria-hidden="true" />
      <Nav />
      <main>
        <Hero />
        <Beats />
        <Blocks />
        <NameStory />
        <Students />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}
