import { describe, expect, test } from "bun:test";
import { runsPerDay } from "./filter";
import { addFilter, loadFilters, removeFilter } from "./savedFilters";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const f = (name: string, status = "") => ({ name, status, mode: "", search: "", includeHidden: false });

describe("runsPerDay", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  test("zero-fills every day and counts by UTC date, oldest first", () => {
    const out = runsPerDay(
      [{ started_at: "2026-10-10T01:00:00Z" }, { started_at: "2026-10-10T23:00:00Z" }, { started_at: "2026-10-08T05:00:00Z" }],
      4,
      now,
    );
    expect(out.map((d) => d.date)).toEqual(["2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10"]);
    expect(out.map((d) => d.count)).toEqual([0, 1, 0, 2]);
  });
  test("runs outside the window are ignored", () => {
    expect(runsPerDay([{ started_at: "2026-01-01T00:00:00Z" }], 3, now).every((d) => d.count === 0)).toBe(true);
  });
});

describe("saved filters", () => {
  test("round-trips through storage, newest first, replacing by name", () => {
    const s = memory();
    let list = addFilter(s, [], f("Failed", "failed"));
    list = addFilter(s, list, f("Live"));
    list = addFilter(s, list, f("failed", "completed"));
    expect(list.map((x) => x.name)).toEqual(["failed", "Live"]);
    expect(loadFilters(s)).toEqual(list);
  });
  test("blank names are ignored and removal persists", () => {
    const s = memory();
    expect(addFilter(s, [], f("   "))).toEqual([]);
    const list = addFilter(s, [], f("A"));
    expect(removeFilter(s, list, "A")).toEqual([]);
    expect(loadFilters(s)).toEqual([]);
  });
  test("corrupt storage yields an empty list instead of throwing", () => {
    const s = { getItem: () => "{not json", setItem: () => {} };
    expect(loadFilters(s)).toEqual([]);
    expect(loadFilters({ getItem: () => JSON.stringify([{ name: 1 }, f("ok")]), setItem: () => {} })).toEqual([f("ok")]);
  });
});
