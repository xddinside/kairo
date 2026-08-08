import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    // Do not run the initial scroll reset after the streamed landing page.
    // Users can start reading while the response finishes; resetting `/` then
    // would send them back to the hero. Workspace routes keep restoration.
    scrollRestoration: ({ location }) => location.pathname !== '/',
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 30_000,
    defaultStaleTime: 15_000,
    defaultPendingMs: 1_000,
    defaultPendingMinMs: 0,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
