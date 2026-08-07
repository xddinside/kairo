import { Button } from '@cloudflare/kumo/components/button'

type RoutePlaceholderProps = {
  path: string
  title: string
}

export function RoutePlaceholder({ path, title }: RoutePlaceholderProps) {
  return (
    <main className="min-h-screen bg-white px-8 py-12 text-slate-950">
      <section className="mx-auto max-w-3xl">
        <p className="text-sm font-medium text-slate-500">Kairo Round 1</p>
        <h1 className="mt-3 text-3xl font-semibold">{title}</h1>
        <p className="mt-3 max-w-xl text-base text-slate-600">
          <code>{path}</code> is ready for its prototype pass.
        </p>
        <div className="mt-6">
          <Button disabled>Kumo UI connected</Button>
        </div>
      </section>
    </main>
  )
}
