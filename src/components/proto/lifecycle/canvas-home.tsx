import { Button } from "@cloudflare/kumo/components/button";
import { Text } from "@cloudflare/kumo/components/text";
import { useKumoToastManager } from "@cloudflare/kumo/components/toast";
import { X } from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { quietSuggestions } from "../canvas-data";
import { DEMO_USER } from "./lifecycle-store";
import { canvasNameFromPrompt, useLifecycle } from "./lifecycle-store";
import { MobileAccountFab } from "./mobile-account-fab";

export function CanvasHome() {
  const navigate = useNavigate();
  const toast = useKumoToastManager();
  const { canvasName, createFirstCanvas } = useLifecycle();
  const [prompt, setPrompt] = useState("");

  const createCanvas = (text: string) => {
    if (!canvasName) {
      const name = canvasNameFromPrompt(text);
      createFirstCanvas(name);
      toast.add({
        title: "Welcome to Kairo",
        description: `Your first canvas “${name}” is saved.`,
        variant: "success",
        timeout: 4000,
      });
    }
    setPrompt("");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    createCanvas(prompt);
  };

  const goToSettings = () =>
    navigate({ to: "/proto/lifecycle", search: { phase: "settings" } });

  return (
    <main className="bg-kumo-canvas">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-7 px-6 pt-0 pb-20 text-center">
        <div className="grid gap-1.5">
          <Text as="h1" variant="heading1">
            What do you want to work on?
          </Text>
          {canvasName ? (
            <Text variant="secondary" size="sm">
              Canvas “{canvasName}” is saved.
            </Text>
          ) : null}
        </div>

        <form
          onSubmit={submit}
          aria-label="Shape your day"
          className="flex w-full items-center gap-2 rounded-full bg-kumo-base py-1.5 pr-2 pl-5 shadow-lg ring ring-kumo-line transition-shadow focus-within:ring-2 focus-within:ring-kumo-focus/50"
        >
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask Kairo to shape your day…"
            aria-label="Ask Kairo"
            className="h-9 min-w-0 flex-1 border-0 bg-transparent px-0 font-sans text-base leading-6 text-kumo-default placeholder:text-kumo-placeholder outline-none focus:outline-none focus:ring-0"
          />
          <Button
            variant="primary"
            type="submit"
            className="shrink-0 rounded-full transition-transform duration-150 ease-out active:scale-[0.96]"
          >
            Generate
          </Button>
        </form>

        <ul className="flex w-full flex-col items-start gap-1">
          {quietSuggestions.map((suggestion) => {
            const Icon = suggestion.icon;
            return (
              <li key={suggestion.text} className="w-full">
                <button
                  type="button"
                  onClick={() => createCanvas(suggestion.text)}
                  className="group flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-kumo-subtle transition-transform hover:bg-kumo-tint hover:text-kumo-default active:scale-[0.96]"
                >
                  <span className="flex h-lh items-center text-kumo-subtle group-hover:text-kumo-strong">
                    <Icon size={16} weight="regular" />
                  </span>
                  <span className="flex-1 text-left">{suggestion.text}</span>
                  <span
                    aria-hidden
                    className="flex h-lh items-center rounded-md p-1 text-kumo-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:bg-kumo-base"
                  >
                    <X size={14} weight="regular" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <MobileAccountFab
        user={DEMO_USER}
        onPress={goToSettings}
        label="Account settings"
      />
    </main>
  );
}
