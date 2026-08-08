import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import { Toasty } from "@cloudflare/kumo/components/toast";
import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties } from "react";
import { z } from "zod";

import { AppSidebar } from "../../components/app-sidebar";
import { AccountFooterLink } from "../../components/proto/lifecycle/account-footer";
import { CanvasHome } from "../../components/proto/lifecycle/canvas-home";
import { IntroModal } from "../../components/proto/lifecycle/intro-modal";
import {
  LifecycleProvider,
  useLifecycle,
} from "../../components/proto/lifecycle/lifecycle-store";
import { SettingsPage } from "../../components/proto/lifecycle/settings-page";
import { SignInScreen } from "../../components/proto/lifecycle/signin-screen";
import { ProtoSwitcher } from "../../components/proto/atoms";

export const Route = createFileRoute("/proto/lifecycle")({
  validateSearch: z.object({
    phase: z.enum(["signin", "canvas", "settings"]).default("signin"),
    reset: z
      .preprocess(
        (value) => value === "1" || value === true,
        z.boolean(),
      )
      .optional(),
  }),
  head: () => ({
    meta: [{ title: "Account lifecycle · Kairo" }],
  }),
  component: LifecycleRoute,
});

function LifecycleRoute() {
  return (
    <Toasty>
      <LifecycleProvider>
        <LifecycleApp />
      </LifecycleProvider>
    </Toasty>
  );
}

function LifecycleApp() {
  const { phase, reset } = useSearch({ from: "/proto/lifecycle" });
  const navigate = useNavigate();
  const { introSeen, canvasName, completeIntro, resetJourney } =
    useLifecycle();
  const [introManualOpen, setIntroManualOpen] = useState(false);

  useEffect(() => {
    if (reset) {
      resetJourney();
      navigate({
        to: "/proto/lifecycle",
        search: { phase: "signin", reset: undefined },
        replace: true,
      });
    }
  }, [reset, navigate, resetJourney]);

  const introOpen = introManualOpen || (phase === "canvas" && !introSeen);

  const handleIntroChange = (open: boolean) => {
    if (open) {
      setIntroManualOpen(true);
    } else {
      if (!introSeen) completeIntro();
      setIntroManualOpen(false);
    }
  };

  if (phase === "signin") {
    return (
      <>
        <SignInScreen />
        <ProtoSwitcher />
        <IntroModal open={false} onOpenChange={handleIntroChange} />
      </>
    );
  }

  return (
    <>
      <ProtoSwitcher />
      <Sidebar.Provider
        collapsible="icon"
        style={
          {
            "--sidebar-active-bg": "var(--color-kumo-base)",
            "--sidebar-bg": "var(--color-kumo-canvas)",
          } as CSSProperties
        }
      >
        <AppSidebar
          active={phase === "settings" ? "account" : "canvas"}
          recentCanvases={
            canvasName ? [{ name: canvasName }] : []
          }
          footer={<AccountFooterLink active={phase === "settings"} />}
        />
        <div className="min-w-0 flex-1">
          {phase === "canvas" ? (
            <CanvasHome />
          ) : (
            <SettingsPage onReplayIntro={() => setIntroManualOpen(true)} />
          )}
        </div>
      </Sidebar.Provider>
      <IntroModal open={introOpen} onOpenChange={handleIntroChange} />
    </>
  );
}
