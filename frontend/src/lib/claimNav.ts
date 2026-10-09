const num = (id: string) => Number(id.replace(/\D/g, "")) || 0;

/** Claim ids in reading order (C1, C2, ... C10), not string order. */
export function orderedClaimIds(ids: readonly string[]): string[] {
  return [...ids].sort((a, b) => num(a) - num(b) || a.localeCompare(b));
}

/** The claim after (+1) or before (-1) `current`, stopping at the ends. Unknown current -> first. */
export function neighbourClaim(ids: readonly string[], current: string | undefined, step: 1 | -1): string | null {
  if (ids.length === 0) return null;
  const at = current === undefined ? -1 : ids.indexOf(current);
  if (at === -1) return ids[0] ?? null;
  return ids[at + step] ?? null;
}

/** True while the person is typing, so J and K must not be hijacked. */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}
