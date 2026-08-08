import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { useKumoToastManager } from "@cloudflare/kumo/components/toast";
import { useState } from "react";

import { useLifecycle } from "./lifecycle-store";

const exportOptions = [
  {
    value: "structured",
    label: "Courses, tasks, and timetable",
  },
  {
    value: "notes",
    label: "Notes",
  },
  {
    value: "files",
    label: "Original files",
  },
] as const;

function exportFileName() {
  return `kairo-export-${new Date().toISOString().slice(0, 10)}.zip`;
}

export function ExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const toast = useKumoToastManager();
  const { recordExport } = useLifecycle();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({
    structured: true,
    notes: true,
    files: true,
  });

  const runExport = async () => {
    setBusy(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setBusy(false);
    const fileName = exportFileName();
    recordExport(fileName);
    toast.add({
      title: "Export ready",
      description: fileName,
      variant: "success",
      timeout: 5000,
    });
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog className="grid gap-5 p-6">
        <div className="grid gap-1">
          <Dialog.Title className="text-lg font-semibold">
            Export my data
          </Dialog.Title>
          <Dialog.Description className="text-sm text-kumo-subtle">
            A zip with your structured data, notes, and original files.
          </Dialog.Description>
        </div>
        <div className="grid gap-1.5">
          {exportOptions.map((option) => (
            <Checkbox
              key={option.value}
              label={option.label}
              checked={selected[option.value]}
              onCheckedChange={(checked) =>
                setSelected((current) => ({
                  ...current,
                  [option.value]: checked,
                }))
              }
            />
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            className="text-sm transition-transform duration-150 ease-out active:scale-[0.96]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            className="text-sm transition-transform duration-150 ease-out active:scale-[0.96]"
            loading={busy}
            onClick={runExport}
          >
            Export
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
