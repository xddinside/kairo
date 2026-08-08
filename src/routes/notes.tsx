import { createFileRoute } from '@tanstack/react-router'

import { RoutePlaceholder } from '../components/route-placeholder'
import { requireAuthenticatedRoute } from "../server/auth/functions";

export const Route = createFileRoute('/notes')({
  beforeLoad: requireAuthenticatedRoute,
  component: NotesRoute,
})

function NotesRoute() {
  return <RoutePlaceholder path="/notes" title="Notes" />
}
