/**
 * Where to send someone right after sign-in or registration.
 *
 * Admins start in the operator console; from there the console links to the workspace, history
 * and every other page. An admin who was already heading somewhere specific (a run, the account
 * page) is sent there instead. Everyone else keeps the workspace default.
 */
const GENERIC_DESTINATIONS = new Set(["#/workspace", "#/new", "#/"]);

export function postAuthDestination(role: string | null | undefined, stored: string | null): string {
  const target = stored && stored.length > 0 ? stored : null;
  if (role === "admin" && (target === null || GENERIC_DESTINATIONS.has(target))) return "#/admin";
  return target ?? "#/workspace";
}
