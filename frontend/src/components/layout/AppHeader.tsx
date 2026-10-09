import type { Run } from "@contracts/types";
import { useAuth } from "../../state/useAuth";
import { ModeBadge } from "../ModeBadge";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { Metric } from "../ui/Metric";
import { AccountMenu } from "./AccountMenu";
import { Tooltip } from "../ui/Tooltip";
import { ThemeToggle } from "./ThemeToggle";

export interface HeaderMetric {
  label: string;
  value: string;
  onClick: () => void;
}

/**
 * The top bar. On a run it shows the question as the page title (truncated, full text on hover or
 * focus), the LIVE/REPLAY badge whenever the rail is not showing it, and cost, time and tokens that
 * each open the timeline filtered to the events behind the number. Below lg it also carries the
 * buttons that open the status and activity sheets.
 */
export function AppHeader({
  runId,
  question,
  mode,
  running,
  showMode,
  metrics,
  onNewRun,
  onOpenStatus,
  onOpenActivity,
}: {
  runId: string | null;
  question: string | undefined;
  mode: Run["mode"] | null;
  running: boolean;
  showMode: boolean;
  metrics: HeaderMetric[];
  onNewRun: () => void;
  onOpenStatus: () => void;
  onOpenActivity: () => void;
}) {
  const { user, logout } = useAuth();

  return (
    <header className="app-header sticky top-0 z-30 flex min-h-16 w-full items-center justify-between lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] border-b border-border-hairline bg-surface/85 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-2.5">
      {/* Left: Brand */}
      <div className="flex items-center gap-3 shrink-0 lg:justify-self-start">
        {runId ? (
          <Button
            size="icon"
            variant="ghost"
            className="lg:hidden"
            aria-label="Open research status"
            icon={<Icon name="PanelLeft" size={20} aria-hidden />}
            onClick={onOpenStatus}
          />
        ) : null}

        <a href="#/" className="flex items-center gap-2 group">
          <span className="text-xl font-bold tracking-tight text-text">SARVAM</span>
        </a>
      </div>

      {/* Center: In Between Navigation or Active Run Question */}
      {question ? (
        <Tooltip text={question} className="min-w-0 max-w-full flex-1 sm:max-w-xl mx-auto px-4" focusable>
          <h1 className="min-w-0 truncate text-sm font-medium text-text text-center">{question}</h1>
        </Tooltip>
      ) : (
        <div className="hidden lg:flex items-center justify-center px-4 lg:justify-self-center">
          <nav
            aria-label="Section Navigation"
            className="flex items-center gap-1.5 text-sm font-medium text-text-muted bg-surface-2/90 border border-border-hairline px-2 py-1 rounded-full shadow-xs"
          >
            <a
              href="#/methodology"
              className="px-3.5 py-1 rounded-full text-text-muted hover:text-text hover:bg-surface transition-all"
            >
              Methodology
            </a>
            <a
              href="#/architecture"
              className="px-3.5 py-1 rounded-full text-text-muted hover:text-text hover:bg-surface transition-all"
            >
              Architecture
            </a>
          </nav>
        </div>
      )}

      {/* Right: User Auth & Workspace controls */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3 lg:justify-self-end">
        {runId && showMode ? <ModeBadge mode={mode} pulsing={running} /> : null}
        {runId ? (
          <div className="hidden items-center gap-5 whitespace-nowrap 2xl:flex" role="group" aria-label="Run totals">
            {metrics.map((m) => (
              <Metric key={m.label} label={m.label} value={m.value} onClick={m.onClick} />
            ))}
          </div>
        ) : null}
        {runId ? (
          <Button
            size="icon"
            variant="ghost"
            className="lg:hidden"
            aria-label="Open activity timeline"
            icon={<Icon name="Activity" size={20} aria-hidden />}
            onClick={onOpenActivity}
          />
        ) : null}
        {runId ? (
          <Button size="sm" icon={<Icon name="Plus" size={16} aria-hidden />} onClick={onNewRun}>
            <span className="max-sm:sr-only">New run</span>
          </Button>
        ) : null}

        {/* User Auth Info */}
        {user ? (
          <AccountMenu user={user} onSignOut={() => void logout()} />
        ) : (
          <div className="flex items-center gap-2 border-l border-border-hairline pl-3">
            <a
              href="#/signin"
              className="text-sm font-medium text-text-muted hover:text-text px-3 py-1.5 transition-colors"
            >
              Sign In
            </a>
            <a
              href="#/register"
              className="btn btn-primary btn-sm"
            >
              Register
            </a>
          </div>
        )}

        <ThemeToggle />
      </div>
    </header>
  );
}
