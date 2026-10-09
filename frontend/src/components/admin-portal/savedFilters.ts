/** Named run-list filters kept in this browser only (nothing leaves the machine). */
export interface RunFilter {
  name: string;
  status: string;
  mode: string;
  search: string;
  includeHidden: boolean;
}

export const SAVED_FILTERS_KEY = "sarvam_admin_saved_filters";
const MAX_SAVED = 12;

type Store = Pick<Storage, "getItem" | "setItem">;

function valid(x: unknown): x is RunFilter {
  if (typeof x !== "object" || x === null) return false;
  const f = x as Record<string, unknown>;
  return (
    typeof f.name === "string" &&
    typeof f.status === "string" &&
    typeof f.mode === "string" &&
    typeof f.search === "string" &&
    typeof f.includeHidden === "boolean"
  );
}

export function loadFilters(store: Store): RunFilter[] {
  try {
    const raw = JSON.parse(store.getItem(SAVED_FILTERS_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter(valid).slice(0, MAX_SAVED) : [];
  } catch {
    return [];
  }
}

function persist(store: Store, filters: RunFilter[]): RunFilter[] {
  try {
    store.setItem(SAVED_FILTERS_KEY, JSON.stringify(filters));
  } catch {
    /* private mode or quota: the filter still works for this session */
  }
  return filters;
}

/** Adds or replaces (by case-insensitive name). Blank names are ignored. Newest first. */
export function addFilter(store: Store, current: RunFilter[], next: RunFilter): RunFilter[] {
  const name = next.name.trim();
  if (!name) return current;
  const rest = current.filter((f) => f.name.toLowerCase() !== name.toLowerCase());
  return persist(store, [{ ...next, name }, ...rest].slice(0, MAX_SAVED));
}

export function removeFilter(store: Store, current: RunFilter[], name: string): RunFilter[] {
  return persist(
    store,
    current.filter((f) => f.name !== name),
  );
}
