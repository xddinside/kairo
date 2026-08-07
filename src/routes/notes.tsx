import { createFileRoute } from '@tanstack/react-router'

import { RoutePlaceholder } from '../components/route-placeholder'

export const Route = createFileRoute('/notes')({ component: NotesRoute })

function NotesRoute() {
  return <RoutePlaceholder path="/notes" title="Notes" />
}
