import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Text } from "@cloudflare/kumo/components/text";
import { useKumoToastManager } from "@cloudflare/kumo/components/toast";
import { Loader } from "@cloudflare/kumo";
import { ArrowRight, Check } from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

type MagicLinkState = "idle" | "sending" | "sent";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function GoogleG({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-2 -2 52 52" aria-hidden="true" fill="currentColor">
      <path d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function stagger(delay: number) {
  return {
    animationDelay: `${delay}ms`,
  };
}

export function SignInScreen() {
  const navigate = useNavigate();
  const toast = useKumoToastManager();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [linkState, setLinkState] = useState<MagicLinkState>("idle");
  const [googleBusy, setGoogleBusy] = useState(false);

  const enterCanvas = () =>
    navigate({ to: "/proto/lifecycle", search: { phase: "canvas" } });

  const continueWithGoogle = async () => {
    setGoogleBusy(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    enterCanvas();
  };

  const sendMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim();
    if (value === "") {
      setEmailError("Enter your email address");
      return;
    }
    if (!emailPattern.test(value)) {
      setEmailError("Enter a valid email address");
      return;
    }
    setEmailError(null);
    setLinkState("sending");
    await new Promise((resolve) => setTimeout(resolve, 700));
    setLinkState("sent");
    toast.add({
      title: "Link sent",
      description: "Check your inbox for the sign-in link.",
      variant: "success",
      timeout: 4000,
    });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    enterCanvas();
  };

  const resetJourney = () =>
    navigate({
      to: "/proto/lifecycle",
      search: { phase: "signin", reset: true },
    });

  return (
    <main className="bg-kumo-canvas">
      <div className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center px-6 py-12">
        <div className="grid gap-8">
          <img
            src="/brand/kairo-icon.svg"
            alt=""
            className="lfc-rise mx-auto h-10 w-10"
            style={stagger(0)}
          />

          <div className="lfc-rise grid gap-1.5 text-center" style={stagger(60)}>
            <Text as="h1" variant="heading1">
              Sign in to Kairo
            </Text>
            <Text variant="secondary" size="sm">
              Your student workspace, shaped around what matters now.
            </Text>
          </div>

          <div className="lfc-rise grid gap-4" style={stagger(120)}>
            <Button
              variant="primary"
              size="lg"
              className="w-full transition-transform duration-150 ease-out active:scale-[0.96]"
              icon={<GoogleG size={14} />}
              loading={googleBusy}
              onClick={continueWithGoogle}
            >
              Continue with Google
            </Button>

            <div className="flex items-center gap-3">
              <span aria-hidden className="h-px flex-1 bg-kumo-line" />
              <span className="text-xs text-kumo-subtle">or</span>
              <span aria-hidden className="h-px flex-1 bg-kumo-line" />
            </div>

            <form
              onSubmit={sendMagicLink}
              className="grid gap-2"
              aria-label="Sign in with email"
              noValidate
            >
              <Input
                type="email"
                name="email"
                size="lg"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (emailError) setEmailError(null);
                }}
                placeholder="you@university.edu"
                aria-label="Email for magic link"
                aria-invalid={emailError != null}
                aria-describedby={emailError ? "email-error" : undefined}
                variant={emailError ? "error" : "default"}
                disabled={linkState !== "idle"}
                autoComplete="email"
              />
              {emailError ? (
                <p
                  id="email-error"
                  role="alert"
                  className="text-xs text-kumo-danger"
                >
                {emailError}
                </p>
              ) : null}
              <Button
                variant="secondary"
                size="lg"
                type="submit"
                className="w-full transition-transform duration-150 ease-out active:scale-[0.96]"
                disabled={linkState !== "idle"}
              >
                Send magic link
                <span key={linkState} className="lfc-rise flex h-lh items-center">
                  {linkState === "sending" ? (
                    <Loader size="sm" />
                  ) : linkState === "sent" ? (
                    <Check size={16} weight="bold" className="text-kumo-success" />
                  ) : (
                    <ArrowRight
                      size={16}
                      weight="bold"
                      className="transition-transform duration-150 ease-out group-hover:translate-x-0.5 motion-reduce:translate-x-0 motion-reduce:transition-none"
                    />
                  )}
                </span>
              </Button>
            </form>
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-kumo-subtle">
          Prototype sign-in. Production uses Clerk with Google and email magic
          links.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full text-kumo-subtle"
          onClick={resetJourney}
        >
          Reset journey
        </Button>
      </div>
    </main>
  );
}
