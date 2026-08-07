import { Text } from '@cloudflare/kumo/components/text'

import {
  ClassesCard,
  ContextLine,
  NotesCard,
  PlanItemCard,
  PromptBox,
  SuggestionChips,
  ViewHeader,
} from './atoms'
import { demoPrompt, planItems } from './canvas-data'

const facts: Array<[string, React.ReactNode]> = [
  ['Courses', '4'],
  ['Open tasks', '8'],
  ['Overdue', <span className="text-kumo-warning">1</span>],
  ['Next class', 'AINN · 9:00 AM'],
]

export function QuietB() {
  return (
    <main className="grid min-h-screen place-items-center bg-kumo-canvas px-6">
      <div className="grid w-full max-w-lg justify-items-center gap-8">
        <div className="grid justify-items-center gap-1.5">
          <ContextLine align="center" />
          <Text as="h1" variant="heading1">
            What do you want to work on?
          </Text>
        </div>
        <PromptBox size="lg" submitTo="/proto/b/today" />
        <SuggestionChips to="/proto/b/today" />
      </div>
    </main>
  )
}

export function TodayB() {
  const [now, next, later] = planItems
  return (
    <main className="grid min-h-screen bg-kumo-canvas lg:grid-cols-[20rem_1fr]">
      <aside className="flex flex-col gap-8 border-b border-kumo-line bg-kumo-base px-5 py-6 lg:border-r lg:border-b-0">
        <div className="grid gap-3">
          <Text as="h2" variant="heading3">
            Canvas
          </Text>
          <PromptBox defaultValue={demoPrompt} submitTo="/proto/b/today" />
        </div>
        <div className="grid gap-3">
          <Text as="h2" variant="heading3">
            What Kairo knows
          </Text>
          <dl className="grid gap-1.5">
            {facts.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-4">
                <dt className="text-base text-kumo-subtle">{label}</dt>
                <dd className="text-base font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="grid gap-3">
          <Text as="h2" variant="heading3">
            Earlier views
          </Text>
          <p className="flex items-baseline gap-2 text-base">
            <span aria-hidden className="size-1.5 shrink-0 translate-y-[-1px] rounded-full bg-kumo-success" />
            <span className="font-medium">Today's plan</span>
            <span className="text-kumo-subtle">8:00 AM</span>
          </p>
        </div>
      </aside>
      <section className="grid content-start gap-8 px-8 py-8">
        <ViewHeader variant="heading1" />
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="xl:col-span-2">
            <PlanItemCard item={now} emphasized />
          </div>
          <PlanItemCard item={next} />
          <PlanItemCard item={later} />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <ClassesCard />
          <NotesCard />
        </div>
      </section>
    </main>
  )
}
