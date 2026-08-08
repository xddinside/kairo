import { useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/unstable/reactivity";

export type ClientRuntimeEnvironment = "local" | "test" | "ci" | "preview" | "production";

export interface ClientRuntimeState {
  readonly environment: ClientRuntimeEnvironment;
  readonly releaseId: string;
}

export const clientRuntimeState = Atom.make<ClientRuntimeState>({
  environment: "local",
  releaseId: "development",
});

export const useClientRuntimeState = (): ClientRuntimeState => useAtomValue(clientRuntimeState);
