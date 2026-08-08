import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Button } from "@cloudflare/kumo/components/button";
import { ArrowSquareOut } from "@phosphor-icons/react";

import type { FocusSurface } from "./focus-store";

export function ConflictDialog({
  open,
  runningTitle,
  runningOrigin,
  onViewSession,
  onEndAndStart,
  onDismiss,
}: {
  open: boolean;
  runningTitle: string;
  runningOrigin: FocusSurface;
  onViewSession: () => void;
  onEndAndStart: () => void;
  onDismiss: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onDismiss()}>
      <Dialog className="max-w-md">
        <Dialog.Title>End the running session?</Dialog.Title>
        <Dialog.Description>
          You can only run one focus session at a time. "
          {runningTitle}
          " is still running on {runningOrigin === "canvas" ? "your Canvas" : "Focus"}.
        </Dialog.Description>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            className="text-sm transition-transform duration-150 ease-out active:scale-[0.96]"
            onClick={onViewSession}
          >
            <ArrowSquareOut aria-hidden="true" size={14} weight="bold" />
            View running session
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Dialog.Close
              render={(props) => (
                <Button
                  {...props}
                  variant="ghost"
                  className="text-sm transition-transform duration-150 ease-out active:scale-[0.96]"
                >
                  Keep running
                </Button>
              )}
            />
            <Button
              variant="primary"
              className="text-sm transition-transform duration-150 ease-out active:scale-[0.96]"
              onClick={onEndAndStart}
            >
              End &amp; start new
            </Button>
          </div>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
