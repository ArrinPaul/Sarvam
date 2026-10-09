import { useEffect, useRef, useState } from "react";
import type { UserPublic } from "@contracts/types";
import { Icon, type IconName } from "../ui/Icon";

interface Item {
  href: string;
  label: string;
  icon: IconName;
}

/** Everything a signed-in person navigates to, behind one avatar button instead of five links. */
export function AccountMenu({ user, onSignOut }: { user: UserPublic; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items: Item[] = [
    { href: "#/workspace", label: "Workspace", icon: "Play" },
    { href: "#/history", label: "Investigation history", icon: "Clock" },
    ...(user.role === "admin"
      ? [{ href: "#/admin", label: "Admin console", icon: "ShieldCheck" as IconName }]
      : []),
    { href: "#/account", label: "Account", icon: "User" },
  ];
  const initial = (user.display_name || user.email).charAt(0).toUpperCase();

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.email}`}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-surface pl-1 pr-2 text-sm font-medium transition-colors hover:bg-surface-2"
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-brand"
        >
          {initial}
        </span>
        <Icon name="ChevronDown" size={14} className="text-text-muted" aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-11 z-50 w-64 rounded-lg border border-border-strong bg-surface p-1 shadow-elevation"
        >
          <div className="border-b border-border-hairline px-3 py-2">
            <p className="truncate text-sm font-semibold">{user.display_name || user.email}</p>
            <p className="truncate text-sm text-text-muted">{user.email}</p>
          </div>
          <div className="py-1">
            {items.map((it) => (
              <a
                key={it.href}
                role="menuitem"
                href={it.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-surface-2"
              >
                <Icon name={it.icon} size={16} className="text-text-muted" aria-hidden />
                {it.label}
              </a>
            ))}
          </div>
          <div className="border-t border-border-hairline pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-surface-2"
            >
              <Icon name="LogOut" size={16} className="text-text-muted" aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
