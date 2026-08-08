import { GearSix } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";

import { DEMO_USER } from "./lifecycle-store";

export function AccountFooterLink({ active }: { active: boolean }) {
  return (
    <Link
      to="/proto/lifecycle"
      search={{ phase: "settings" }}
      aria-current={active ? "page" : undefined}
      className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 transition-transform duration-150 ease-out active:scale-[0.96] ${
        active ? "bg-kumo-tint" : "hover:bg-kumo-tint"
      } group-data-[state=collapsed]/sidebar:justify-center`}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-kumo-fill text-sm font-semibold text-kumo-default">
        {DEMO_USER.initials}
      </span>
      <span className="min-w-0 flex-1 text-left group-data-[state=collapsed]/sidebar:hidden">
        <span className="block truncate text-lg leading-5 font-medium text-kumo-default">
          {DEMO_USER.name}
        </span>
        <span className="block truncate text-sm text-kumo-subtle">
          {DEMO_USER.email}
        </span>
      </span>
      <GearSix
        size={16}
        weight="regular"
        className="shrink-0 text-kumo-subtle group-data-[state=collapsed]/sidebar:hidden"
      />
    </Link>
  );
}
