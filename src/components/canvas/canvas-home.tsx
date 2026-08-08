import { Button } from "@cloudflare/kumo/components/button";
import { Text } from "@cloudflare/kumo/components/text";
import { BookOpen, CalendarBlank, Database, ListChecks, X } from "@phosphor-icons/react";
import { useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { createCanvas } from "../../server/canvas/functions";
import { seedDemoData } from "../../server/demo-data/functions";
import { generateCanvasView } from "../../server/generation/functions";

const suggestions = [
  { text: "What should I work on right now? Give me 2\u20133 things.", icon: ListChecks },
  { text: "Plan my quiz prep", icon: BookOpen },
  { text: "What can wait until Friday?", icon: CalendarBlank },
] as const;

const titleFromRequest = (request: string): string => {
  const normalized = request.trim().replace(/\s+/g, " ");
  return normalized.length <= 52 ? normalized : `${normalized.slice(0, 49).trimEnd()}...`;
};

/** Fresh Canvas home that saves on the first meaningful request. */
export function CanvasHome() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [dismissed, setDismissed] = useState<ReadonlyArray<string>>([]);
  const [seedState, setSeedState] = useState<"idle" | "pending" | "success" | "error">("idle");

  const submitRequest = async (request: string) => {
    const text = request.trim();
    if (!text || pending) return;
    setPending(true);
    setError(undefined);
    try {
      const result = await createCanvas({
        data: {
          clientRequestId: crypto.randomUUID(),
          title: titleFromRequest(text),
          activity: { kind: "request", text, sourceViewId: null, fileIds: [] },
        },
      });
      const generated = await generateCanvasView({
        data: {
          canvasId: result.canvas.id,
          requestActivityId: result.activity.id,
          expectedVersion: result.canvas.version,
          clientRequestId: crypto.randomUUID(),
        },
      });
      if (generated._tag === "clarification_required") {
        sessionStorage.setItem(`kairo:clarification:${result.canvas.id}`, JSON.stringify({
          ...generated,
          requestActivityId: result.activity.id,
          expectedVersion: result.canvas.version,
        }));
      } else if (generated._tag !== "view_ready") {
        sessionStorage.setItem(`kairo:recovery:${result.canvas.id}`, JSON.stringify({
          requestActivityId: result.activity.id,
          expectedVersion: result.canvas.version,
        }));
      }
      await router.navigate({
        to: "/canvas/$canvasId",
        params: { canvasId: result.canvas.id },
      });
      void router.invalidate();
    } catch {
      setError("Kairo could not generate this view. Try again.");
    } finally {
      setPending(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void submitRequest(prompt);
  };

  const seed = async () => {
    if (seedState === "pending") return;
    setSeedState("pending");
    try {
      await seedDemoData();
      setSeedState("success");
      void router.invalidate();
    } catch {
      setSeedState("error");
    }
  };

  const visible = suggestions.filter(
    (suggestion) => !dismissed.includes(suggestion.text),
  );

  return (
    <main className="bg-kumo-canvas">
      <div className="mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-3xl flex-col items-center justify-center gap-8 px-6 pt-0 pb-20 text-center md:min-h-screen">
        <div className="mt-12">
          <Text as="h1" variant="heading1">
            What do you want to work on?
          </Text>
        </div>

        <form
          onSubmit={submit}
          aria-label="Shape your day"
          className="flex w-full items-center gap-2 rounded-full bg-kumo-base py-1.5 ps-5 pe-2 shadow-lg ring ring-kumo-line transition-shadow focus-within:ring-2 focus-within:ring-kumo-focus/50"
        >
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask Kairo to shape your day…"
            aria-label="Ask Kairo"
            className="h-9 min-w-0 flex-1 border-0 bg-transparent px-0 font-sans text-lg leading-6 text-kumo-default placeholder:text-kumo-placeholder outline-none focus:outline-none focus:ring-0"
          />
          <Button
            variant="primary"
            size="base"
            type="submit"
            disabled={pending}
            className="shrink-0 rounded-full text-lg transition-transform duration-150 ease-out active:not-disabled:scale-[0.96]"
          >
            {pending ? "Generating" : "Generate"}
          </Button>
        </form>

        <div className="grid justify-items-center gap-1.5">
          <Button
            type="button"
            variant="secondary"
            disabled={seedState === "pending" || seedState === "success"}
            onClick={() => void seed()}
            icon={<Database aria-hidden="true" size={16} />}
            className="transition-transform duration-150 ease-out active:not-disabled:scale-[0.96]"
          >
            {seedState === "pending" ? "Seeding" : seedState === "success" ? "Demo data ready" : "Seed demo data"}
          </Button>
          {seedState === "error" ? <p role="alert" className="text-sm text-kumo-danger">Could not seed demo data.</p> : null}
        </div>

        {error ? (
          <p role="alert" className="text-base text-kumo-danger">
            {error}
          </p>
        ) : null}

        <ul className="flex w-full flex-col items-start gap-1.5">
          {visible.map((suggestion) => {
            const Icon = suggestion.icon;
            return (
              <li key={suggestion.text}>
                <div className="group flex items-center gap-2.5 rounded-md px-3 py-2 text-lg text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-default">
                  <span className="flex h-lh items-center text-kumo-subtle group-hover:text-kumo-strong">
                    <Icon aria-hidden="true" size={18} weight="regular" />
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void submitRequest(suggestion.text)}
                    className="flex-1 text-left transition-transform duration-150 ease-out active:not-disabled:scale-[0.96]"
                  >
                    {suggestion.text}
                  </button>
                  <button
                    type="button"
                    aria-label={`Dismiss suggestion: ${suggestion.text}`}
                    onClick={() =>
                      setDismissed((current) => [...current, suggestion.text])
                    }
                    className="flex h-lh items-center rounded-md p-1 text-kumo-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:bg-kumo-base focus-visible:opacity-100"
                  >
                    <X aria-hidden="true" size={16} weight="regular" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
