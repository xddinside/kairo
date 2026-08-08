import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { useKumoToastManager } from "@cloudflare/kumo/components/toast";
import { DeleteResource } from "@cloudflare/kumo";
import {
  DownloadSimple,
  EnvelopeSimple,
  GoogleLogo,
  SignOut,
  Trash,
} from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { DEMO_USER } from "./lifecycle-store";
import { useLifecycle } from "./lifecycle-store";
import { ExportDialog } from "./export-dialog";
import { MobileAccountFab } from "./mobile-account-fab";

export function SettingsPage({
  onReplayIntro,
}: {
  onReplayIntro: () => void;
}) {
  const navigate = useNavigate();
  const toast = useKumoToastManager();
  const { introSeen, exportName, deleteAccount } = useLifecycle();
  const [exportOpen, setExportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const signOut = () => {
    toast.add({
      title: "Signed out",
      variant: "default",
      timeout: 2500,
    });
    navigate({ to: "/proto/lifecycle", search: { phase: "signin" } });
  };

  const handleDelete = async () => {
    setDeleting(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    deleteAccount();
    toast.add({
      title: "Your account has been deleted",
      description: "All of your Kairo data has been permanently removed.",
      variant: "warning",
      timeout: 6000,
    });
    navigate({ to: "/proto/lifecycle", search: { phase: "signin" } });
  };

  const goToCanvas = () =>
    navigate({ to: "/proto/lifecycle", search: { phase: "canvas" } });

  return (
    <main className="bg-kumo-canvas">
      <div className="mx-auto w-full max-w-2xl px-6 py-12 pb-24">
        <header className="flex items-center justify-between gap-4">
          <Text as="h1" variant="heading1">
            Account settings
          </Text>
          <Button
            variant="ghost"
            className="text-sm transition-transform duration-150 ease-out active:scale-[0.96]"
            onClick={signOut}
          >
            <SignOut size={14} />
            Sign out
          </Button>
        </header>

        <div className="mt-8 grid gap-6">
          <LayerCard className="px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-kumo-fill text-sm font-semibold text-kumo-default">
                {DEMO_USER.initials}
              </span>
              <div className="grid min-w-0 gap-0.5">
                <span className="truncate text-sm font-medium text-kumo-default">
                  {DEMO_USER.name}
                </span>
                <span className="truncate text-xs text-kumo-subtle">
                  {DEMO_USER.email}
                </span>
              </div>
              <Badge variant="secondary" className="ms-auto shrink-0">
                Google
              </Badge>
            </div>
          </LayerCard>

          <LayerCard className="divide-y divide-kumo-line">
            <div className="flex items-center gap-3 px-5 py-3.5">
              <span className="flex h-lh shrink-0 items-center text-kumo-subtle">
                <GoogleLogo size={16} weight="regular" />
              </span>
              <span className="flex-1 text-sm text-kumo-default">
                Continue with Google
              </span>
              <Badge variant="success">Connected</Badge>
            </div>
            <div className="flex items-center gap-3 px-5 py-3.5">
              <span className="flex h-lh shrink-0 items-center text-kumo-subtle">
                <EnvelopeSimple size={16} weight="regular" />
              </span>
              <span className="flex-1 text-sm text-kumo-default">
                Email magic links
              </span>
              <Badge variant="success">Enabled</Badge>
            </div>
          </LayerCard>

          <LayerCard className="px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex-1 text-sm text-kumo-default">
                Introduction
              </span>
              {introSeen ? <Badge>Completed</Badge> : null}
              <Button
                variant="ghost"
                size="sm"
                className="transition-transform duration-150 ease-out active:scale-[0.96]"
                onClick={onReplayIntro}
              >
                Replay
              </Button>
            </div>
          </LayerCard>

          <LayerCard className="divide-y divide-kumo-line">
            <div className="flex items-center gap-3 px-5 py-3.5">
              <span className="flex-1 text-sm text-kumo-default">
                Export my data
              </span>
              {exportName ? (
                <span className="truncate font-mono text-xs text-kumo-subtle">
                  {exportName}
                </span>
              ) : null}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setExportOpen(true)}
              >
                <DownloadSimple size={14} />
                Export data
              </Button>
            </div>
            <div className="flex items-center gap-3 px-5 py-3.5">
              <span className="flex-1 text-sm text-kumo-default">
                Delete account
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash size={14} />
                Delete account
              </Button>
            </div>
          </LayerCard>
        </div>
      </div>

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <DeleteResource
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        resourceType="account"
        resourceName={DEMO_USER.email}
        deleteButtonText="Delete account"
        isDeleting={deleting}
        onDelete={handleDelete}
      />

      <MobileAccountFab
        user={DEMO_USER}
        onPress={goToCanvas}
        label="Back to canvas"
      />
    </main>
  );
}
