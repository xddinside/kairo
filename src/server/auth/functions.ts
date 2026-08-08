import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";

export const getAuthenticationState = createServerFn({ method: "GET" }).handler(async () => ({
  authenticated: true as const,
}));

const isAuthenticationFailure = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false;
  return (value as { readonly code?: unknown }).code === "unauthenticated";
};

export const requireAuthenticatedRoute = async (): Promise<void> => {
  try {
    await getAuthenticationState();
  } catch (error) {
    if (isAuthenticationFailure(error)) throw redirect({ href: "/sign-in" });
    throw error;
  }
};
