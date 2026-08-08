import { Outlet, createFileRoute } from "@tanstack/react-router";

import { requireAuthenticatedRoute } from "../server/auth/functions";

export const Route = createFileRoute("/canvas")({
  beforeLoad: requireAuthenticatedRoute,
  component: Outlet,
});
