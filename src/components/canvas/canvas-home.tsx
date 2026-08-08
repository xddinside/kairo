import { Button } from "@cloudflare/kumo/components/button";
import { Text } from "@cloudflare/kumo/components/text";
import { useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { createCanvas } from "../../server/canvas/functions";

const suggestions = [
  "Plan my next seven days",
  "Show what needs attention",
  "Help me choose what to study",
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

  const submitRequest = async (request: string) => {
    const text = request.trim();
    if (!text || pending) return;
    setPending(true);
    setError(undefined);
    try {
      const result = await createCanvas({ data: {
        clientRequestId: crypto.randomUUID(),
        title: titleFromRequest(text),
        activity: { kind: "request", text, sourceViewId: null, fileIds: [] },
      } });
      await router.navigate({ to: "/canvas/$canvasId", params: { canvasId: result.canvas.id } });
      void router.invalidate();
    } catch {
      setError("Canvas could not be saved. Try again.");
    } finally {
      setPending(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void submitRequest(prompt);
  };

  return (
    <main className="bg-kumo-canvas">
      <div className="mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-3xl flex-col items-center justify-center gap-7 px-4 pb-20 text-center md:min-h-screen md:px-6">
        <Text as="h1" variant="heading1">What do you want to work on?</Text>
        <form onSubmit={submit} className="flex w-full items-center gap-2 rounded-full bg-kumo-base py-1.5 pe-2 ps-5 shadow-lg ring ring-kumo-line focus-within:ring-2 focus-within:ring-kumo-focus/50">
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask Kairo"
            aria-label="Ask Kairo"
            className="h-9 min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-base text-kumo-default placeholder:text-kumo-placeholder outline-none"
          />
          <Button type="submit" disabled={pending || !prompt.trim()} className="shrink-0 rounded-full transition-transform active:not-disabled:scale-[0.96]">
            {pending ? "Saving" : "Start"}
          </Button>
        </form>
        {error ? <p role="alert" className="text-sm text-kumo-danger">{error}</p> : null}
        <ul className="grid w-full gap-1">
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button type="button" onClick={() => void submitRequest(suggestion)} className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-default active:scale-[0.96]">
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
