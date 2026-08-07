import { LayerCard } from '@cloudflare/kumo/components/layer-card'
import { Text } from '@cloudflare/kumo/components/text'
import { Link } from '@tanstack/react-router'

import { chipLinkClass } from './atoms'

const layouts = [
  {
    id: 'a',
    name: 'Docked prompt column',
    blurb:
      'Chosen direction. The prompt docks into a floating bar pinned to the bottom of the screen — always in reach, never in the way — and the generated view unfolds above it in one focused column.',
    quiet: '/proto/a',
    today: '/proto/a/today',
  },
  {
    id: 'b',
    name: 'Split workspace',
    blurb:
      'The prompt docks into a left rail with context and history, and the empty canvas becomes the workspace. Kept for comparison.',
    quiet: '/proto/b',
    today: '/proto/b/today',
  },
  {
    id: 'c',
    name: 'Command board',
    blurb:
      'A constant command bar up top; the board below fills with the plan, classes, and notes. Kept for comparison.',
    quiet: '/proto/c',
    today: '/proto/c/today',
  },
] as const

export function ProtoIndex() {
  return (
    <main className="min-h-screen bg-kumo-canvas px-6 py-12">
      <div className="mx-auto grid max-w-4xl gap-6">
        <div className="grid gap-1.5">
          <Text as="h1" variant="heading1">
            Canvas journey prototypes
          </Text>
          <Text variant="secondary">
            Three layout answers to one question: how the quiet canvas and the generated view read
            as one adaptive workspace, not a chat app. Same seeded Monday data in all three; the
            final visual direction is a separate decision. A is the chosen direction, refined.
          </Text>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {layouts.map((layout) => (
            <LayerCard key={layout.id} className="px-5 py-4">
              <div className="grid content-start gap-4">
                <div className="grid gap-1.5">
                  <Text as="h2" variant="heading3">
                    {layout.name}
                  </Text>
                  <Text variant="secondary">{layout.blurb}</Text>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={layout.quiet} className={chipLinkClass}>
                    Quiet state
                  </Link>
                  <Link to={layout.today} className={chipLinkClass}>
                    Generated view
                  </Link>
                </div>
              </div>
            </LayerCard>
          ))}
        </div>
      </div>
    </main>
  )
}
