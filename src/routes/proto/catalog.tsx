import { createFileRoute } from "@tanstack/react-router";

import { CatalogPrototype } from "../../components/proto/catalog-prototype";

export const Route = createFileRoute("/proto/catalog")({
  head: () => ({
    meta: [{ title: "Catalog and routes · Kairo" }],
  }),
  component: CatalogPrototypeRoute,
});

function CatalogPrototypeRoute() {
  return <CatalogPrototype />;
}
