import { createFileRoute } from '@tanstack/react-router'

import { RoutePlaceholder } from '../components/route-placeholder'
import { requireAuthenticatedRoute } from "../server/auth/functions";

export const Route = createFileRoute('/focus')({
  beforeLoad: requireAuthenticatedRoute,
  component: FocusRoute,
})

function FocusRoute() {
  return <RoutePlaceholder path="/focus" title="Focus" />
}
