import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export const DEMO_USER = {
  name: "Ava Reyes",
  email: "ava@student.edu",
  initials: "AR",
} as const;

export type Phase = "signin" | "canvas" | "settings";

type LifecycleStoreValue = {
  introSeen: boolean;
  canvasName: string | null;
  exportName: string | null;
  completeIntro: () => void;
  createFirstCanvas: (name: string) => void;
  recordExport: (name: string) => void;
  deleteAccount: () => void;
  resetJourney: () => void;
};

const LifecycleContext = createContext<LifecycleStoreValue | null>(null);

export function LifecycleProvider({ children }: { children: ReactNode }) {
  const [introSeen, setIntroSeen] = useState(false);
  const [canvasName, setCanvasName] = useState<string | null>(null);
  const [exportName, setExportName] = useState<string | null>(null);

  const value = useMemo<LifecycleStoreValue>(
    () => ({
      introSeen,
      canvasName,
      exportName,
      completeIntro: () => setIntroSeen(true),
      createFirstCanvas: (name) => setCanvasName(name),
      recordExport: (name) => setExportName(name),
      deleteAccount: () => {
        setIntroSeen(false);
        setCanvasName(null);
        setExportName(null);
      },
      resetJourney: () => {
        setIntroSeen(false);
        setCanvasName(null);
        setExportName(null);
      },
    }),
    [introSeen, canvasName, exportName],
  );

  return (
    <LifecycleContext.Provider value={value}>
      {children}
    </LifecycleContext.Provider>
  );
}

export function useLifecycle(): LifecycleStoreValue {
  const context = useContext(LifecycleContext);
  if (!context) {
    throw new Error("useLifecycle must be used within LifecycleProvider");
  }
  return context;
}

export function canvasNameFromPrompt(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "New canvas";
  const words = trimmed.split(/\s+/);
  const name = words.join(" ");
  if (name.length <= 40) {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  let base = "";
  for (const word of words) {
    if ((base + " " + word).trim().length > 40) break;
    base = (base + " " + word).trim();
  }
  return `${base}…`;
}
