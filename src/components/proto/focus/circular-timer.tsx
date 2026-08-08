import { formatClock } from "./focus-store";

export function CircularTimer({
  remainingMs,
  totalMs,
  label,
  tone = "brand",
}: {
  remainingMs: number;
  totalMs: number;
  label: string;
  tone?: "brand" | "success";
}) {
  const radius = 120;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, Math.max(0, 1 - remainingMs / totalMs));
  const dash = circumference * (1 - progress);
  const color = tone === "brand" ? "var(--color-kumo-brand)" : "var(--color-kumo-success)";

  return (
    <div className="relative grid place-items-center">
      <svg
        width="280"
        height="280"
        viewBox="0 0 280 280"
        aria-hidden="true"
        className="block"
      >
        <circle
          cx="140"
          cy="140"
          r={radius}
          fill="none"
          stroke="var(--color-kumo-line)"
          strokeWidth={stroke}
        />
        <circle
          cx="140"
          cy="140"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dash}
          transform="rotate(-90 140 140)"
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="grid justify-items-center gap-1">
          <span
            className="font-sans text-6xl font-semibold tracking-tight text-kumo-strong tabular-nums"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {formatClock(remainingMs)}
          </span>
          <span className="text-sm font-medium text-kumo-subtle">{label}</span>
        </div>
      </div>
    </div>
  );
}
