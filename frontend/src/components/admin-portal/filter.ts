import type { AdminRunRow, AdminUserRow } from "@contracts/types";

const norm = (s: string) => s.trim().toLowerCase();

/** Client-side search over an already-loaded page of runs (id, question, owner). */
export function filterRuns(rows: readonly AdminRunRow[], query: string): AdminRunRow[] {
  const q = norm(query);
  if (!q) return [...rows];
  return rows.filter((r) =>
    [r.id, r.question, r.user_email ?? ""].some((f) => f.toLowerCase().includes(q)),
  );
}

export function filterUsers(rows: readonly AdminUserRow[], query: string): AdminUserRow[] {
  const q = norm(query);
  if (!q) return [...rows];
  return rows.filter((u) =>
    [u.id, u.email, u.display_name].some((f) => f.toLowerCase().includes(q)),
  );
}

/** Runs started per UTC day for the last `days` days (oldest first), zero-filled. */
export function runsPerDay(
  rows: readonly Pick<AdminRunRow, "started_at">[],
  days: number,
  now: Date = new Date(),
): { date: string; count: number }[] {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    buckets.set(day(new Date(now.getTime() - i * 86_400_000)), 0);
  }
  for (const r of rows) {
    const d = r.started_at.slice(0, 10);
    if (buckets.has(d)) buckets.set(d, (buckets.get(d) ?? 0) + 1);
  }
  return [...buckets].map(([date, count]) => ({ date, count }));
}
