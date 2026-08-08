import { createFileRoute } from '@tanstack/react-router'

import { RoutePlaceholder } from '../components/route-placeholder'
import { requireAuthenticatedRoute } from "../server/auth/functions";

export const Route = createFileRoute('/timetable')({
  beforeLoad: requireAuthenticatedRoute,
  component: TimetableRoute,
})

function TimetableRoute() {
  return <RoutePlaceholder path="/timetable" title="Timetable" />
}
