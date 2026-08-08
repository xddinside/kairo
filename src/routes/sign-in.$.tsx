import { SignIn } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sign-in/$")({
  head: () => ({ meta: [{ title: "Sign in · Kairo" }] }),
  component: SignInRoute,
});

function SignInRoute() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <SignIn
        path="/sign-in"
        routing="path"
        signInUrl="/sign-in"
        signUpUrl="/sign-in"
        fallbackRedirectUrl="/canvas"
      />
    </main>
  );
}
