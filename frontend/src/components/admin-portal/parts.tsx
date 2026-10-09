import type { ReactNode } from "react";
import { Card } from "../ui/Card";
import type { Tone } from "../ui/chips";
import { Icon, type IconName } from "../ui/Icon";

/** Small presentational parts shared by the console views. Colour is always paired with a word. */

const SWATCH: Record<Tone, string> = {
  ok: "bg-ok-fg",
  warn: "bg-warn-fg",
  bad: "bg-bad-fg",
  info: "bg-info-fg",
  brand: "bg-brand",
  muted: "bg-border-strong",
};

export function initials(name: string): string {
  const parts = name
    .replace(/@.*$/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  const letters = (parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [parts[0] ?? "?"])
    .map((p) => p?.[0] ?? "")
    .join("");
  return (letters || "?").slice(0, 2).toUpperCase();
}

/** Initials in a quiet circle: identifies a person at a glance without a photo. */
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-2 font-semibold text-brand ${
        size === "sm" ? "h-8 w-8 text-sm" : "h-10 w-10 text-base"
      }`}
    >
      {initials(name)}
    </span>
  );
}

/** One number, named, with its unit or context underneath. */
export function StatTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: IconName;
  label: string;
  value: ReactNode;
  sub?: string;
}) {
  return (
    <Card pad="md" className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-brand"
      >
        <Icon name={icon} size={18} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="label">{label}</p>
        <p className="mt-0.5 truncate font-mono text-2xl font-semibold leading-tight tabular-nums">{value}</p>
        {sub ? <p className="mt-0.5 text-sm text-text-muted">{sub}</p> : null}
      </div>
    </Card>
  );
}

/** A compact segmented control: one choice from a few, always visible (no dropdown). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="label max-sm:sr-only">{label}</span>
      <div
        role="group"
        aria-label={label}
        className="inline-flex rounded-md border border-border-strong bg-surface p-0.5"
      >
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
              className={`h-8 rounded px-3 text-sm font-medium transition-colors pointer-coarse:min-h-11 ${
                on ? "bg-brand text-on-brand" : "text-text-muted hover:bg-surface-2 hover:text-text"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface Slice {
  label: string;
  value: number;
  tone: Tone;
}

/** One bar split by share, with a legend that carries the numbers and words. */
export function StackedBar({
  data,
  empty,
  label,
}: {
  data: readonly Slice[];
  empty: string;
  label: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p className="text-sm text-text-muted">{empty}</p>;
  const shown = data.filter((d) => d.value > 0);
  return (
    <div className="flex flex-col gap-3">
      <div
        role="img"
        aria-label={`${label}: ${shown.map((d) => `${d.label} ${d.value}`).join(", ")}`}
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-surface-2"
      >
        {shown.map((d) => (
          <span
            key={d.label}
            title={`${d.label}: ${d.value}`}
            className={`h-full ${SWATCH[d.tone]}`}
            style={{ width: `${(d.value / total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-sm ${SWATCH[d.tone]}`} />
            <span className="text-text-muted">{d.label}</span>
            <span className="mono ml-auto font-semibold">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Thin spend bar against a quota. The words ("$1.20 of $5.00") are the real value. */
export function QuotaBar({ spent, quota }: { spent: number; quota: number }) {
  const pct = quota > 0 ? Math.min(100, (spent / quota) * 100) : spent > 0 ? 100 : 0;
  const tone: Tone = pct >= 100 ? "bad" : pct >= 80 ? "warn" : "brand";
  return (
    <span aria-hidden="true" className="block h-1.5 w-28 overflow-hidden rounded-full bg-surface-2">
      <span className={`block h-full ${SWATCH[tone]}`} style={{ width: `${pct}%` }} />
    </span>
  );
}

/** A labelled value row for detail lists. */
export function DefRow({ icon, label, children }: { icon?: IconName; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-2">
      {icon ? <Icon name={icon} size={16} className="mt-0.5 shrink-0 text-text-muted" aria-hidden /> : null}
      <dt className="w-36 shrink-0 text-text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{children}</dd>
    </div>
  );
}

/** Tone and icon for an activity event type, so a failure reads as a failure at a glance. */
export function eventLook(type: string): { icon: IconName; tone: Tone } {
  if (type.endsWith("failed") || type.endsWith("rejected")) return { icon: "XOctagon", tone: "bad" };
  if (type.startsWith("budget.")) return { icon: "AlertTriangle", tone: "warn" };
  if (type.startsWith("conflict.")) return { icon: "Zap", tone: "warn" };
  if (type.endsWith("completed") || type.endsWith("verified")) return { icon: "CheckCircle", tone: "ok" };
  if (type.startsWith("stop.")) return { icon: "Square", tone: "info" };
  if (type.startsWith("run.") || type.startsWith("phase.") || type.startsWith("round.")) {
    return { icon: "Play", tone: "info" };
  }
  return { icon: "Circle", tone: "muted" };
}

export const TONE_TEXT: Record<Tone, string> = {
  ok: "text-ok-fg",
  warn: "text-warn-fg",
  bad: "text-bad-fg",
  info: "text-info-fg",
  brand: "text-brand",
  muted: "text-text-muted",
};
