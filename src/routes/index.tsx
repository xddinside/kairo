import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: "Kairo — a workspace shaped around what matters now" },
      {
        name: "description",
        content: "A calm workspace for the work that matters now.",
      },
    ],
  }),
})
