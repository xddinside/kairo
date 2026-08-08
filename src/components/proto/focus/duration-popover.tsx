import { Popover } from "@cloudflare/kumo/components/popover";
import { Switch } from "@cloudflare/kumo/components/switch";
import { SlidersHorizontal } from "@phosphor-icons/react";
import { useState } from "react";

import { useFocus } from "./focus-store";

const MIN_WINDOW = 1;
const MAX_WINDOW = 180;

function clampMinutes(value: number) {
  if (Number.isNaN(value)) return 1;
  return Math.min(MAX_WINDOW, Math.max(MIN_WINDOW, Math.round(value)));
}

export function DurationPopover() {
  const { prefs, updatePrefs } = useFocus();
  const [work, setWork] = useState(String(prefs.workMin));
  const [short, setShort] = useState(String(prefs.shortMin));
  const [long, setLong] = useState(String(prefs.longMin));

  const commit = (patch: Parameters<typeof updatePrefs>[0]) => {
    updatePrefs(patch);
  };

  return (
    <Popover>
      <Popover.Trigger
        aria-label="Pomodoro settings"
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-kumo-subtle transition-transform duration-150 ease-out hover:bg-kumo-tint hover:text-kumo-default active:scale-[0.96]"
      >
        <SlidersHorizontal aria-hidden="true" size={18} weight="regular" />
      </Popover.Trigger>
      <Popover.Content
        align="end"
        side="top"
        className="w-72"
      >
        <Popover.Title>Pomodoro windows</Popover.Title>
        <div className="grid gap-4 px-4 pt-2 pb-4">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-kumo-default">
              Focus session
            </span>
            <span className="flex items-center gap-2">
              <input
                type="number"
                min={MIN_WINDOW}
                max={MAX_WINDOW}
                value={work}
                aria-label="Focus session minutes"
                onChange={(event) => setWork(event.target.value)}
                onBlur={() => commit({ workMin: clampMinutes(Number(work)) })}
                className="h-10 w-20 rounded-lg border-0 bg-kumo-base px-3 text-base text-kumo-default tabular-nums ring ring-kumo-line outline-none focus:ring-2 focus:ring-kumo-focus/50"
              />
              <span className="text-sm text-kumo-subtle">minutes</span>
            </span>
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-kumo-default">
              Short break
            </span>
            <span className="flex items-center gap-2">
              <input
                type="number"
                min={MIN_WINDOW}
                max={MAX_WINDOW}
                value={short}
                aria-label="Short break minutes"
                onChange={(event) => setShort(event.target.value)}
                onBlur={() => commit({ shortMin: clampMinutes(Number(short)) })}
                className="h-10 w-20 rounded-lg border-0 bg-kumo-base px-3 text-base text-kumo-default tabular-nums ring ring-kumo-line outline-none focus:ring-2 focus:ring-kumo-focus/50"
              />
              <span className="text-sm text-kumo-subtle">minutes</span>
            </span>
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-kumo-default">
              Long break
            </span>
            <span className="flex items-center gap-2">
              <input
                type="number"
                min={MIN_WINDOW}
                max={MAX_WINDOW}
                value={long}
                aria-label="Long break minutes"
                onChange={(event) => setLong(event.target.value)}
                onBlur={() => commit({ longMin: clampMinutes(Number(long)) })}
                className="h-10 w-20 rounded-lg border-0 bg-kumo-base px-3 text-base text-kumo-default tabular-nums ring ring-kumo-line outline-none focus:ring-2 focus:ring-kumo-focus/50"
              />
              <span className="text-sm text-kumo-subtle">minutes</span>
            </span>
          </label>
          <div className="flex items-center justify-between gap-3 border-t border-kumo-line pt-3">
            <span className="grid gap-0.5">
              <span className="text-sm font-medium text-kumo-default">
                Breaks after sessions
              </span>
              <span className="text-xs text-kumo-subtle">
                Long break after every 4th session
              </span>
            </span>
            <Switch
              checked={prefs.breaksEnabled}
              onCheckedChange={(checked) =>
                commit({ breaksEnabled: checked === true })
              }
              aria-label="Breaks after sessions"
            />
          </div>
        </div>
      </Popover.Content>
    </Popover>
  );
}
