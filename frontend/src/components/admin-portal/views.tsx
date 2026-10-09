import type {
  AdminActivity,
  AdminAudit,
  AdminCosts,
  AdminHealth,
  AdminOverview,
  AdminRunDetail,
  AdminRunPage,
  AdminRunRow,
  AdminSettings,
  AdminUserRow,
  FinalState,
} from "@contracts/types";
import type { ReactNode } from "react";
import { ApiError } from "../../api/client";
import { formatUsd } from "../../lib/format";
import { ModeBadge } from "../ModeBadge";
import { Banner } from "../ui/Banner";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { BarSeries, HBarList } from "../ui/Charts";
import { type Column, DataTable } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { Icon } from "../ui/Icon";
import { Panel } from "../ui/Panel";
import { SkeletonLines } from "../ui/Skeleton";
import { StateChip } from "../ui/StateChip";
import { failureChip, finalStateChip, runStatusChip } from "../ui/chips";
import {
  BUDGET_FIELDS,
  type BudgetKey,
  type BudgetText,
  parseBudgetForm,
} from "./budgetForm";
import { filterRuns, filterUsers } from "./filter";
import {
  Avatar,
  DefRow,
  QuotaBar,
  Segmented,
  type Slice,
  StackedBar,
  StatTile,
  TONE_TEXT,
  eventLook,
} from "./parts";

const fmtTokens = (n: number) => n.toLocaleString("en-US");
const fmtDate = (iso: string | null | undefined) =>
  iso ? `${new Date(iso).toISOString().replace("T", " ").slice(0, 16)} UTC` : "—";
const toData = (rec: Record<string, number>, name: (key: string) => string = (k) => k) =>
  Object.entries(rec)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, value]) => ({ label: name(key), value }));

/** Loading / error / ready wrapper. 401 and 403 get their own words: the server is the gate. */
export function ResourceView<T>({
  loading,
  error,
  data,
  label,
  children,
}: {
  loading: boolean;
  error: Error | null;
  data: T | null;
  label: string;
  children: (data: T) => ReactNode;
}) {
  if (error) {
    const status = error instanceof ApiError ? error.status : null;
    const msg =
      status === 401
        ? "Your session has expired. Sign in again."
        : status === 403
          ? "The server refused this request: admin role required."
          : `Could not load ${label}: ${error.message}`;
    return <Banner tone="bad">{msg}</Banner>;
  }
  if (!data) return loading ? <SkeletonLines rows={5} label={`Loading ${label}`} /> : null;
  return <>{children(data)}</>;
}

export function PageTitle({
  title,
  description,
  aside,
}: {
  title: string;
  description?: string;
  aside?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-base text-text-muted">{description}</p> : null}
      </div>
      {aside}
    </header>
  );
}

const STATUS_TONE: Record<string, Slice["tone"]> = {
  completed: "ok",
  failed: "bad",
  running: "info",
  queued: "muted",
};
const STATUS_ORDER = ["completed", "running", "queued", "failed"];

function statusSlices(rec: Record<string, number>): Slice[] {
  const known = STATUS_ORDER.map((k) => ({
    label: k.charAt(0).toUpperCase() + k.slice(1),
    value: rec[k] ?? 0,
    tone: STATUS_TONE[k] ?? "muted",
  }));
  const extra = Object.entries(rec)
    .filter(([k]) => !STATUS_ORDER.includes(k))
    .map(([k, v]) => ({ label: k, value: v, tone: "muted" as const }));
  return [...known, ...extra];
}

// ------------------------------------------------------------------ overview

interface AttentionItem {
  icon: "XOctagon" | "AlertTriangle" | "Play";
  tone: "bad" | "warn" | "info";
  text: string;
  href: string;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function OverviewView({
  overview,
  health,
}: {
  overview: AdminOverview;
  health: AdminHealth | null;
}) {
  const replay = overview.runs_by_mode.REPLAY ?? 0;
  const failed = overview.runs_by_status.failed ?? 0;
  const failureTotal = health ? Object.values(health.failures).reduce((a, b) => a + b, 0) : 0;
  const attention: AttentionItem[] = [];
  if (failed > 0) {
    attention.push({ icon: "XOctagon", tone: "bad", text: `${plural(failed, "failed run")}`, href: "#/admin/runs" });
  }
  if (failureTotal > 0) {
    attention.push({
      icon: "AlertTriangle",
      tone: "warn",
      text: `${plural(failureTotal, "typed failure")} recorded`,
      href: "#/admin/health",
    });
  }
  if (overview.insufficient_runs > 0) {
    attention.push({
      icon: "AlertTriangle",
      tone: "warn",
      text: `${plural(overview.insufficient_runs, "run")} ended without enough evidence`,
      href: "#/admin/runs",
    });
  }
  if (health && health.running_runs > 0) {
    attention.push({
      icon: "Play",
      tone: "info",
      text: `${plural(health.running_runs, "run")} in progress`,
      href: "#/admin/runs",
    });
  }
  return (
    <div className="flex flex-col gap-5">
      {health ? (
        <Banner tone={health.status === "healthy" ? "ok" : "warn"}>
          System {health.status}: database {health.db_ok ? "reachable" : "unreachable"}, gateway
          mode {health.mode.toUpperCase()}, {health.running_runs} run(s) in progress.{" "}
          <a className="font-semibold underline" href="#/admin/health">
            Details
          </a>
        </Banner>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon="Users" label="Users" value={overview.users} sub={`${overview.admins} admin`} />
        <StatTile icon="Table" label="Runs" value={overview.runs} sub={`${replay} replayed`} />
        <StatTile
          icon="Coins"
          label="Total cost"
          value={formatUsd(overview.total_cost_usd)}
          sub="from the audit log"
        />
        <StatTile icon="Activity" label="Tokens" value={fmtTokens(overview.total_tokens)} sub="all runs" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Runs by status">
            <StackedBar
              label="Runs by status"
              data={statusSlices(overview.runs_by_status)}
              empty="No runs yet"
            />
          </Panel>
        </div>
        <Panel title="Needs attention">
          {attention.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-text-muted">
              <Icon name="CheckCircle" size={16} className="text-ok-fg" aria-hidden />
              Nothing needs attention right now.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {attention.map((a) => (
                <li key={a.text}>
                  <a
                    href={a.href}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2"
                  >
                    <Icon name={a.icon} size={16} className={`shrink-0 ${TONE_TEXT[a.tone]}`} aria-hidden />
                    <span className="flex-1">{a.text}</span>
                    <Icon name="ArrowRight" size={14} className="text-text-muted" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Runs by mode">
          <HBarList data={toData(overview.runs_by_mode)} empty="No runs yet" />
        </Panel>
        <Panel title="Stop state: did it know it was done?">
          <HBarList
            data={toData(overview.stop_states, (k) => finalStateChip(k as FinalState).label)}
            empty="No finished runs yet"
          />
          {overview.insufficient_runs > 0 ? (
            <p className="mt-3 text-sm text-text-muted">
              {overview.insufficient_runs} run(s) ended INSUFFICIENT: they reported that the
              evidence was not enough instead of guessing.
            </p>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------- runs

export const RUN_STATUSES = ["", "queued", "running", "completed", "failed"] as const;
export const RUN_MODES = ["", "LIVE", "REPLAY"] as const;

const STATUS_OPTIONS = RUN_STATUSES.map((v) => ({
  value: v as string,
  label: v === "" ? "All" : v.charAt(0).toUpperCase() + v.slice(1),
}));
const MODE_OPTIONS = RUN_MODES.map((v) => ({ value: v as string, label: v === "" ? "All" : v }));

const runColumns: Column<AdminRunRow>[] = [
  {
    key: "id",
    header: "Run",
    render: (r) => <span className="mono">{r.id}</span>,
    sortValue: (r) => r.id,
  },
  {
    key: "question",
    header: "Question",
    render: (r) => (
      <span className="block min-w-56 max-w-md">
        <span className="line-clamp-2">
          {r.hidden ? (
            <span className="mr-1.5 inline-flex items-center gap-1 rounded border border-border-strong bg-surface-2 px-1.5 text-sm text-text-muted">
              <Icon name="Minus" size={12} aria-hidden />
              hidden
            </span>
          ) : null}
          {r.question}
        </span>
        <span className="mt-0.5 block truncate text-sm text-text-muted">
          {r.user_email ?? "anonymous"}
        </span>
      </span>
    ),
    sortValue: (r) => r.question,
  },
  {
    key: "mode",
    header: "Mode",
    render: (r) => (
      <span className="inline-block whitespace-nowrap">
        <ModeBadge mode={r.mode} />
      </span>
    ),
    sortValue: (r) => r.mode,
  },
  {
    key: "status",
    header: "Status",
    render: (r) => (
      <span className="inline-block whitespace-nowrap">
        <StateChip spec={runStatusChip(r.status)} />
      </span>
    ),
    sortValue: (r) => r.status,
  },
  {
    key: "stop",
    header: "Stop state",
    render: (r) =>
      r.stop_state ? (
        <span className="inline-block whitespace-nowrap">
          <StateChip spec={finalStateChip(r.stop_state)} />
        </span>
      ) : (
        "—"
      ),
    sortValue: (r) => r.stop_state ?? "",
  },
  {
    key: "cost",
    header: "Cost",
    align: "right",
    render: (r) => formatUsd(r.cost_usd),
    sortValue: (r) => r.cost_usd,
  },
  {
    key: "started",
    header: "Started",
    render: (r) => <span className="mono whitespace-nowrap">{fmtDate(r.started_at)}</span>,
    sortValue: (r) => r.started_at,
  },
];

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="label">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o || "All"}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SearchBox({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <Icon
        name="Search"
        size={14}
        className="pointer-events-none absolute left-3 top-[13px] text-text-muted"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        placeholder={label}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full min-w-56 rounded-md border border-border-strong bg-surface pl-9 pr-3 text-sm"
      />
    </label>
  );
}

export function RunsView({
  page,
  search,
  onSearch,
  status,
  onStatus,
  mode,
  onMode,
  onOpen,
  onPage,
  includeHidden,
  onIncludeHidden,
  onExport,
}: {
  includeHidden: boolean;
  onIncludeHidden: (v: boolean) => void;
  onExport: () => void;
  page: AdminRunPage;
  search: string;
  onSearch: (v: string) => void;
  status: string;
  onStatus: (v: string) => void;
  mode: string;
  onMode: (v: string) => void;
  onOpen: (r: AdminRunRow) => void;
  onPage: (offset: number) => void;
}) {
  const rows = filterRuns(page.items, search);
  const from = page.total === 0 ? 0 : page.offset + 1;
  const to = page.offset + page.items.length;
  return (
    <div className="flex flex-col gap-3">
      <Card pad="sm" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-56 flex-1">
            <SearchBox
              value={search}
              onChange={onSearch}
              label="Search this page by id, question or owner"
            />
          </div>
          <Button size="sm" onClick={onExport} icon={<Icon name="Download" size={14} aria-hidden />}>
            Export CSV
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Segmented label="Status" value={status} options={STATUS_OPTIONS} onChange={onStatus} />
          <Segmented label="Mode" value={mode} options={MODE_OPTIONS} onChange={onMode} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeHidden}
              onChange={(e) => onIncludeHidden(e.target.checked)}
              className="h-4 w-4 accent-brand"
            />
            <span>Show hidden</span>
          </label>
        </div>
      </Card>
      <DataTable
        caption="All runs"
        columns={runColumns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={onOpen}
        initialSort={{ key: "started", dir: "desc" }}
        empty={
          <EmptyState
            title="No runs match"
            why="Clear the filters or start a run from the workspace."
          />
        }
      />
      <div className="flex items-center justify-between text-sm text-text-muted">
        <span className="mono">
          {from}–{to} of {page.total}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={page.offset === 0}
            onClick={() => onPage(Math.max(0, page.offset - page.limit))}
          >
            Previous
          </Button>
          <Button size="sm" disabled={to >= page.total} onClick={() => onPage(page.offset + page.limit)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- run detail

export function RunDetailView({
  detail,
  onBack,
  onStop,
  onToggleHidden,
  busy = false,
  error = null,
}: {
  detail: AdminRunDetail;
  onBack: () => void;
  onStop: () => void;
  onToggleHidden: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  const r = detail.run;
  const active = r.status === "running" || r.status === "queued";
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onBack}
          icon={<Icon name="ArrowLeft" size={14} aria-hidden />}
        >
          All runs
        </Button>
      </div>
      <Card pad="lg">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mono text-text-muted">{r.id}</span>
          <ModeBadge mode={r.mode} />
          <StateChip spec={runStatusChip(r.status)} />
          {r.stop_state ? <StateChip spec={finalStateChip(r.stop_state)} /> : null}
        </div>
        <h2 className="mt-3 max-w-3xl text-xl font-semibold leading-snug">{r.question}</h2>
        <dl className="mt-4 grid text-sm sm:grid-cols-2 sm:gap-x-8">
          <DefRow icon="User" label="Owner">
            {r.user_email ?? "anonymous"}
          </DefRow>
          <DefRow icon="Calendar" label="Started">
            <span className="mono whitespace-nowrap">{fmtDate(r.started_at)}</span>
          </DefRow>
          <DefRow icon="Clock" label="Ended because">
            {r.termination_reason ? r.termination_reason.replace(/_/g, " ") : "not recorded yet"}
          </DefRow>
          <DefRow icon="Minus" label="Visibility">
            {r.hidden ? "Hidden from run lists" : "Listed"}
          </DefRow>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border-hairline pt-4">
          {active ? (
            <Button size="sm" variant="danger" disabled={busy} onClick={onStop} icon={<Icon name="Square" size={14} aria-hidden />}>
              Stop run
            </Button>
          ) : null}
          <Button size="sm" disabled={busy} onClick={onToggleHidden}>
            {r.hidden ? "Unhide run" : "Hide run"}
          </Button>
          <a
            className="inline-flex h-8 items-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-sm font-medium hover:bg-surface-2"
            href={`#/run/${encodeURIComponent(r.id)}`}
          >
            Open the full run view
            <Icon name="ArrowRight" size={14} aria-hidden />
          </a>
        </div>
        {r.hidden ? (
          <p className="mt-3 text-sm text-text-muted">
            Hidden from every run list. Its evidence, events and cost are kept and still counted.
          </p>
        ) : null}
        {error ? (
          <div className="mt-3">
            <Banner tone="bad">{error}</Banner>
          </div>
        ) : null}
      </Card>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon="Coins" label="Cost" value={formatUsd(detail.cost_usd)} />
        <StatTile icon="Activity" label="Tokens" value={fmtTokens(detail.tokens)} />
        <StatTile icon="FileText" label="Events" value={detail.event_count} />
        <StatTile icon="Zap" label="Open conflicts" value={detail.conflicts_by_status.open ?? 0} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Claims by status">
          <HBarList data={toData(detail.claims_by_status)} empty="No claims stored" />
        </Panel>
        <Panel title="Coverage (latest round)">
          <HBarList data={toData(detail.coverage_by_state)} empty="No coverage computed" />
        </Panel>
        <Panel title="Conflicts">
          <HBarList data={toData(detail.conflicts_by_status)} empty="No conflicts" />
        </Panel>
        <Panel title="Challenge outcomes">
          <HBarList data={toData(detail.challenges_by_outcome)} empty="No challenges recorded" />
        </Panel>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------- users

export type UserAction = "toggle-role" | "toggle-disabled" | "quota" | "delete";

const userColumns: Column<AdminUserRow>[] = [
  {
    key: "email",
    header: "User",
    render: (u) => (
      <span className="flex items-center gap-3">
        <Avatar name={u.display_name || u.email} size="sm" />
        <span className="min-w-0">
          <span className="block truncate font-medium text-text">{u.display_name}</span>
          <span className="block truncate text-text-muted">{u.email}</span>
        </span>
      </span>
    ),
    sortValue: (u) => u.email,
  },
  {
    key: "role",
    header: "Role",
    render: (u) => (
      <StateChip
        spec={
          u.disabled
            ? { icon: "XOctagon", label: "disabled", tone: "bad" }
            : u.role === "admin"
              ? { icon: "ShieldCheck", label: "admin", tone: "brand" }
              : { icon: "User", label: "user", tone: "muted" }
        }
      />
    ),
    sortValue: (u) => `${u.disabled ? "z" : "a"}${u.role}`,
  },
  {
    key: "runs",
    header: "Runs",
    align: "right",
    render: (u) => u.run_count,
    sortValue: (u) => u.run_count,
  },
  {
    key: "cost",
    header: "Spend and quota",
    render: (u) =>
      u.quota_usd == null ? (
        <span className="flex flex-col gap-0.5">
          <span className="mono">{formatUsd(u.cost_usd)}</span>
          <span className="text-text-muted">unlimited</span>
        </span>
      ) : (
        <span className="flex flex-col gap-1">
          <span className="mono">
            {formatUsd(u.cost_usd)} of {formatUsd(u.quota_usd)}
          </span>
          <QuotaBar spent={u.cost_usd} quota={u.quota_usd} />
        </span>
      ),
    sortValue: (u) => u.cost_usd,
  },
  {
    key: "created",
    header: "Joined",
    render: (u) => <span className="mono whitespace-nowrap">{fmtDate(u.created_at)}</span>,
    sortValue: (u) => u.created_at,
  },
  {
    key: "login",
    header: "Last sign-in",
    render: (u) => <span className="mono whitespace-nowrap">{fmtDate(u.last_login_at)}</span>,
    sortValue: (u) => u.last_login_at ?? "",
  },
];

export function UsersView({
  users,
  search,
  onSearch,
  currentUserId,
  onAction,
}: {
  users: AdminUserRow[];
  search: string;
  onSearch: (v: string) => void;
  currentUserId: string;
  onAction: (action: UserAction, user: AdminUserRow) => void;
}) {
  const columns: Column<AdminUserRow>[] = [
    ...userColumns,
    {
      key: "actions",
      header: "Actions",
      render: (u) => {
        const self = u.id === currentUserId;
        const why = self ? "You cannot change your own account here" : undefined;
        return (
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="ghost" disabled={self} title={why} onClick={() => onAction("toggle-role", u)}>
              {u.role === "admin" ? "Make user" : "Make admin"}
            </Button>
            <Button size="sm" variant="ghost" disabled={self} title={why} onClick={() => onAction("toggle-disabled", u)}>
              {u.disabled ? "Enable" : "Disable"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onAction("quota", u)}>
              Quota
            </Button>
            <Button size="sm" variant="danger" disabled={self} title={why} onClick={() => onAction("delete", u)}>
              Delete
            </Button>
          </div>
        );
      },
    },
  ];
  const admins = users.filter((u) => u.role === "admin").length;
  const disabled = users.filter((u) => u.disabled).length;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-56 flex-1 sm:max-w-sm">
          <SearchBox value={search} onChange={onSearch} label="Search by name, email or id" />
        </div>
        <p className="mono text-text-muted">
          {users.length} users · {admins} admin · {disabled} off
        </p>
      </div>
      <DataTable
        caption="Registered users"
        columns={columns}
        rows={filterUsers(users, search)}
        rowKey={(u) => u.id}
        initialSort={{ key: "created", dir: "desc" }}
        empty={<EmptyState title="No users match" why="Try a different search." />}
      />
    </div>
  );
}

// --------------------------------------------------------------------- costs

export function CostsView({
  costs,
  onDays,
  onExport,
}: {
  costs: AdminCosts;
  onDays: (d: 7 | 30 | 90) => void;
  onExport: () => void;
}) {
  const peak = costs.daily.reduce<{ date: string; cost_usd: number } | null>(
    (best, d) => (best === null || d.cost_usd > best.cost_usd ? d : best),
    null,
  );
  const perDay = costs.days > 0 ? costs.total_cost_usd / costs.days : 0;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Range"
          value={String(costs.days)}
          options={[
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
          ]}
          onChange={(v) => onDays(Number(v) as 7 | 30 | 90)}
        />
        <Button size="sm" onClick={onExport} icon={<Icon name="Download" size={14} aria-hidden />}>
          Export CSV
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon="Coins" label={`Cost, last ${costs.days} days`} value={formatUsd(costs.total_cost_usd)} />
        <StatTile icon="Activity" label="Tokens" value={fmtTokens(costs.total_tokens)} />
        <StatTile icon="Calendar" label="Average per day" value={formatUsd(perDay)} />
        <StatTile
          icon="TrendingUp"
          label="Busiest day"
          value={peak && peak.cost_usd > 0 ? formatUsd(peak.cost_usd) : "—"}
          sub={peak && peak.cost_usd > 0 ? peak.date : "no metered cost"}
        />
      </div>
      <Panel title="Daily cost (UTC)">
        <BarSeries
          label={`Daily cost over the last ${costs.days} days`}
          data={costs.daily.map((d) => ({ label: d.date, value: d.cost_usd }))}
          format={formatUsd}
          height={160}
        />
        <div className="mono mt-1 flex justify-between text-sm text-text-muted">
          <span>{costs.daily[0]?.date}</span>
          <span>{costs.daily[costs.daily.length - 1]?.date}</span>
        </div>
      </Panel>
      <Panel title="Cost by event type">
        <HBarList
          data={costs.by_event_type.map((t) => ({ label: t.type, value: t.cost_usd }))}
          format={formatUsd}
          empty="No metered events in this range"
        />
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------------ activity

export function ActivityView({
  activity,
  type,
  onType,
  types,
}: {
  activity: AdminActivity;
  type: string;
  onType: (v: string) => void;
  types: readonly string[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select label="Event type" value={type} options={["", ...types]} onChange={onType} />
        <p className="mono text-text-muted">{activity.items.length} most recent</p>
      </div>
      {activity.items.length === 0 ? (
        <EmptyState title="No events" why="The audit log has no events of this type yet." />
      ) : (
        <Card as="section">
          <ol className="flex flex-col divide-y divide-border-hairline">
            {activity.items.map((e) => {
              const look = eventLook(e.type);
              return (
                <li key={e.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                  <Icon
                    name={look.icon}
                    size={16}
                    className={`mt-0.5 shrink-0 ${TONE_TEXT[look.tone]}`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-3">
                      <span className="mono font-semibold">{e.type}</span>
                      <a
                        className="mono text-brand hover:underline"
                        href={`#/admin/runs/${encodeURIComponent(e.run_id)}`}
                      >
                        {e.run_id}
                      </a>
                    </p>
                    {e.summary && e.summary !== e.type ? (
                      <p className="mt-0.5 truncate text-text-muted" title={e.summary}>
                        {e.summary}
                      </p>
                    ) : null}
                  </div>
                  <div className="mono shrink-0 text-right text-text-muted">
                    <p>{fmtDate(e.ts)}</p>
                    <p>
                      #{e.id}
                      {e.cost_usd != null ? ` · ${formatUsd(e.cost_usd)}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </div>
  );
}

// -------------------------------------------------------------------- health

function CheckTile({
  icon,
  label,
  children,
}: {
  icon: "Server" | "ShieldCheck" | "FileText" | "Globe" | "Play";
  label: string;
  children: ReactNode;
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
        <div className="mono mt-1 break-words">{children}</div>
      </div>
    </Card>
  );
}

export function HealthView({ health }: { health: AdminHealth }) {
  const b = health.budget_defaults;
  const flag = (on: boolean, yes: string, no: string) => (
    <StateChip
      spec={
        on
          ? { icon: "CheckCircle", label: yes, tone: "ok" }
          : { icon: "XOctagon", label: no, tone: "bad" }
      }
    />
  );
  return (
    <div className="flex flex-col gap-5">
      <Banner tone={health.status === "healthy" ? "ok" : "warn"}>System {health.status}.</Banner>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <CheckTile icon="Server" label="Database">
          {flag(health.db_ok, "reachable", "unreachable")}
        </CheckTile>
        <CheckTile icon="ShieldCheck" label="Foreign keys">
          {flag(health.db_foreign_keys, "on", "off")}
        </CheckTile>
        <CheckTile icon="FileText" label="Journal mode">
          {health.db_journal_mode}
        </CheckTile>
        <CheckTile icon="FileText" label="Schema version">
          {health.schema_version}
        </CheckTile>
        <CheckTile icon="Globe" label="Gateway mode">
          {health.mode.toUpperCase()}
        </CheckTile>
        <CheckTile icon="Play" label="Runs in progress">
          {health.running_runs}
        </CheckTile>
      </div>
      <Panel title="Default run budget">
        <p className="mono text-sm">
          {b.max_searches} searches · {b.max_fetches} fetches · {b.max_llm_calls} LLM calls ·{" "}
          {formatUsd(b.max_cost_usd ?? 0)}
        </p>
        <p className="mt-2 text-sm">
          <a className="text-brand hover:underline" href="#/admin/settings">
            Change in Settings
          </a>
        </p>
      </Panel>
      <Panel title="Typed failures (SSOT 18)">
        {Object.keys(health.failures).length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-text-muted">
            <Icon name="CheckCircle" size={16} className="text-ok-fg" aria-hidden />
            No failures recorded.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {Object.entries(health.failures).map(([name, n]) => (
              <li key={name} className="flex items-center gap-1.5">
                <StateChip spec={failureChip(name)} />
                <span className="mono text-sm">{n}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

// --------------------------------------------------------------------- audit

const ACTION_LABEL: Record<string, string> = {
  "user.update": "Updated user",
  "user.delete": "Deleted user",
  "run.stop": "Stopped run",
  "run.hide": "Hid run",
  "run.unhide": "Unhid run",
  "settings.update": "Changed default budget",
  "settings.reset": "Reset default budget",
  "export.runs": "Exported runs CSV",
  "export.costs": "Exported costs CSV",
};

export function AuditView({ audit }: { audit: AdminAudit }) {
  if (audit.items.length === 0) {
    return <EmptyState title="No admin actions yet" why="Every change made in this console is recorded here." />;
  }
  return (
    <Card as="section">
      <ol className="flex flex-col divide-y divide-border-hairline">
        {audit.items.map((a) => {
          const detail = Object.entries(a.detail ?? {});
          return (
            <li key={a.id} className="flex items-start gap-3 px-4 py-3 text-sm">
              <Avatar name={a.actor_email} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold">{ACTION_LABEL[a.action] ?? a.action}</span>
                  {a.target_id ? (
                    <span className="mono rounded border border-border-hairline bg-surface-2 px-1.5">
                      {a.target_id}
                    </span>
                  ) : null}
                </p>
                <p className="text-text-muted">by {a.actor_email}</p>
                {detail.length > 0 ? (
                  <p
                    className="mono mt-1 flex flex-wrap gap-x-4 gap-y-1 text-text-muted"
                    title={JSON.stringify(a.detail)}
                  >
                    {detail.map(([k, v]) => (
                      <span key={k}>
                        {k}: {typeof v === "object" ? JSON.stringify(v) : String(v)}
                      </span>
                    ))}
                  </p>
                ) : null}
              </div>
              <div className="mono shrink-0 text-right text-text-muted">
                <p>{fmtDate(a.ts)}</p>
                <p>#{a.id}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

// ------------------------------------------------------------------ settings

const FIELD_GROUPS: { title: string; blurb: string; keys: BudgetKey[] }[] = [
  {
    title: "Sources",
    blurb: "How much of the web one run may search and fetch.",
    keys: ["max_searches", "max_fetches"],
  },
  {
    title: "Model use",
    blurb: "Hard ceilings on language-model calls and spend.",
    keys: ["max_llm_calls", "max_cost_usd"],
  },
  {
    title: "Time and rounds",
    blurb: "When a run starts wrapping up, and when it is cut off.",
    keys: ["max_wall_seconds_soft", "max_wall_seconds_hard", "max_followup_rounds"],
  },
];

const FIELD_HINT: Record<BudgetKey, string> = {
  max_searches: "Search queries issued per run.",
  max_fetches: "Pages downloaded per run.",
  max_llm_calls: "Planner, extractor, verifier and writer calls combined.",
  max_cost_usd: "Metered spend that stops the run.",
  max_wall_seconds_soft: "After this the run wraps up with what it has.",
  max_wall_seconds_hard: "The run is cut off here. Not below the soft limit.",
  max_followup_rounds: "Challenge and follow-up rounds after the first pass.",
};

export function SettingsView({
  settings,
  values,
  onChange,
  onSave,
  onReset,
  busy,
  error,
  saved,
}: {
  settings: AdminSettings;
  values: BudgetText;
  onChange: (key: BudgetKey, value: string) => void;
  onSave: () => void;
  onReset: () => void;
  busy: boolean;
  error: string | null;
  saved: boolean;
}) {
  const { errors } = parseBudgetForm(values);
  const invalid = Object.keys(errors).length > 0;
  const byKey = new Map<BudgetKey, (typeof BUDGET_FIELDS)[number]>(
    BUDGET_FIELDS.map((f) => [f.key, f]),
  );
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Banner tone={settings.customized ? "info" : "ok"}>
        {settings.customized
          ? "Using a stored default budget. New runs start from these limits; a run may still override them."
          : "Using the environment default budget. Save changes to override it for all new runs."}
      </Banner>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!invalid && !busy) onSave();
        }}
      >
        {FIELD_GROUPS.map((g) => (
          <Panel key={g.title} title={g.title}>
            <p className="mb-4 text-sm text-text-muted">{g.blurb}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {g.keys.map((key) => {
                const f = byKey.get(key);
                if (!f) return null;
                return (
                  <label key={key} className="flex flex-col gap-1 text-sm">
                    <span className="font-semibold">{f.label}</span>
                    <input
                      inputMode="decimal"
                      value={values[key]}
                      aria-invalid={errors[key] ? true : undefined}
                      aria-describedby={`hint-${key}`}
                      onChange={(e) => onChange(key, e.target.value)}
                      className={`mono h-10 rounded-md border bg-surface px-3 ${
                        errors[key] ? "border-bad-fg" : "border-border-strong"
                      }`}
                    />
                    {errors[key] ? (
                      <span id={`hint-${key}`} className="flex items-center gap-1 text-bad-fg">
                        <Icon name="XOctagon" size={14} aria-hidden />
                        {errors[key]}
                      </span>
                    ) : (
                      <span id={`hint-${key}`} className="text-text-muted">
                        {FIELD_HINT[key]}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </Panel>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary" disabled={invalid || busy}>
            {busy ? "Saving…" : "Save default budget"}
          </Button>
          <Button type="button" variant="secondary" disabled={busy || !settings.customized} onClick={onReset}>
            Reset to environment defaults
          </Button>
          {saved ? (
            <span className="flex items-center gap-1 text-sm text-ok-fg">
              <Icon name="CheckCircle" size={16} aria-hidden />
              Saved.
            </span>
          ) : null}
        </div>
      </form>
      {error ? <Banner tone="bad">{error}</Banner> : null}
    </div>
  );
}
