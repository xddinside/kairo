import { createFileRoute, redirect } from '@tanstack/react-router'

import { requireAuthenticatedRoute } from "../server/auth/functions";

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    await requireAuthenticatedRoute();
    throw redirect({ to: '/canvas' })
  },
})
