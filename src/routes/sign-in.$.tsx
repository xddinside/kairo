import { Loader } from "@cloudflare/kumo";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Text } from "@cloudflare/kumo/components/text";
import {
  AuthenticateWithRedirectCallback,
  useSignIn,
  useSignUp,
} from "@clerk/tanstack-react-start";
import { ArrowRight, Check } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

type EmailState = "idle" | "sending" | "sent";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Route = createFileRoute("/sign-in/$")({
  head: () => ({ meta: [{ title: "Sign in · Kairo" }] }),
  component: SignInRoute,
});

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
  return { animationDelay: `${delay}ms` };
}

function errorMessage(error: unknown): string {
  if (typeof error !== "object" || error === null) return "Something went wrong. Try again.";
  const candidate = error as { longMessage?: string; message?: string };
  return candidate.longMessage ?? candidate.message ?? "Something went wrong. Try again.";
}

function SignInRoute() {
  const { _splat } = Route.useParams();

  if (_splat === "sso-callback") {
    return (
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/canvas"
        signUpFallbackRedirectUrl="/canvas"
      />
    );
  }

  return <SignInForm />;
}

function SignInForm() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailState, setEmailState] = useState<EmailState>("idle");
  const [googleBusy, setGoogleBusy] = useState(false);

  const continueWithGoogle = async () => {
    setGoogleBusy(true);
    const { error } = await signIn.sso({
      strategy: "oauth_google",
      redirectCallbackUrl: "/sign-in/sso-callback",
      redirectUrl: "/canvas",
    });
    if (error) {
      setEmailError(errorMessage(error));
      setGoogleBusy(false);
    }
  };

  const sendMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    const emailAddress = email.trim();
    if (!emailPattern.test(emailAddress)) {
      setEmailError(emailAddress === "" ? "Enter your email address" : "Enter a valid email address");
      return;
    }

    setEmailError(null);
    setEmailState("sending");
    const verificationUrl = `${window.location.origin}/sign-in/verify`;
    const signInResult = await signIn.emailLink.sendLink({ emailAddress, verificationUrl });

    if (!signInResult.error) {
      setEmailState("sent");
      const result = await signIn.emailLink.waitForVerification();
      if (result.error) {
        setEmailError(errorMessage(result.error));
        setEmailState("idle");
      } else if (signIn.status === "complete") {
        await signIn.finalize({ navigate: ({ decorateUrl }) => window.location.assign(decorateUrl("/canvas")) });
      }
      return;
    }

    const created = await signUp.create({ emailAddress });
    if (created.error) {
      setEmailError(errorMessage(created.error));
      setEmailState("idle");
      return;
    }
    const sent = await signUp.verifications.sendEmailLink({ verificationUrl });
    if (sent.error) {
      setEmailError(errorMessage(sent.error));
      setEmailState("idle");
      return;
    }

    setEmailState("sent");
    const result = await signUp.verifications.waitForEmailLinkVerification();
    if (result.error) {
      setEmailError(errorMessage(result.error));
      setEmailState("idle");
    } else if (signUp.status === "complete") {
      await signUp.finalize({ navigate: ({ decorateUrl }) => window.location.assign(decorateUrl("/canvas")) });
    }
  };

  return (
    <main className="bg-kumo-canvas">
      <div className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center px-6 py-12">
        <div className="grid gap-8">
          <img src="/brand/kairo-icon.svg" alt="" className="lfc-rise mx-auto h-10 w-10" style={stagger(0)} />
          <div className="lfc-rise grid gap-1.5 text-center" style={stagger(60)}>
            <Text as="h1" variant="heading1">Sign in to Kairo</Text>
            <Text variant="secondary" size="sm">Your student workspace, shaped around what matters now.</Text>
          </div>
          <div className="lfc-rise grid gap-4" style={stagger(120)}>
            <Button variant="primary" size="lg" className="w-full transition-transform duration-150 ease-out active:scale-[0.96]" icon={<GoogleG size={14} />} loading={googleBusy} onClick={continueWithGoogle}>
              Continue with Google
            </Button>
            <div className="flex items-center gap-3">
              <span aria-hidden className="h-px flex-1 bg-kumo-line" />
              <span className="text-xs text-kumo-subtle">or</span>
              <span aria-hidden className="h-px flex-1 bg-kumo-line" />
            </div>
            <form onSubmit={sendMagicLink} className="grid gap-2" aria-label="Continue with email" noValidate>
              <Input type="email" name="email" size="lg" value={email} onChange={(event) => { setEmail(event.target.value); if (emailError) setEmailError(null); }} placeholder="you@university.edu" aria-label="Email for magic link" aria-invalid={emailError != null} aria-describedby={emailError ? "email-error" : undefined} variant={emailError ? "error" : "default"} disabled={emailState !== "idle"} autoComplete="email" />
              {emailError ? <p id="email-error" role="alert" className="text-xs text-kumo-danger">{emailError}</p> : null}
              {emailState === "sent" ? <p role="status" className="text-center text-sm text-kumo-subtle">Check your inbox to continue.</p> : null}
              <Button variant="secondary" size="lg" type="submit" className="w-full transition-transform duration-150 ease-out active:scale-[0.96]" disabled={emailState !== "idle"}>
                Send magic link
                <span key={emailState} className="lfc-rise flex h-lh items-center">
                  {emailState === "sending" ? <Loader size="sm" /> : emailState === "sent" ? <Check size={16} weight="bold" className="text-kumo-success" /> : <ArrowRight size={16} weight="bold" className="transition-transform duration-150 ease-out group-hover:translate-x-0.5 motion-reduce:translate-x-0 motion-reduce:transition-none" />}
                </span>
              </Button>
              <div id="clerk-captcha" />
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
