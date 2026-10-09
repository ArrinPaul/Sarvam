import { useEffect, useMemo, useState } from "react";
import { ageBucket, safeHref } from "../../lib/format";
import { isTypingTarget, neighbourClaim, orderedClaimIds } from "../../lib/claimNav";
import { highlightRanges } from "../../lib/quote";
import { useEvidence } from "../../state/EvidenceContext";
import { useClaimEvidence } from "../../state/useClaimEvidence";
import { useSession } from "../../state/useRunSession";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { methodText } from "../OriginGroupView";
import { Skeleton } from "../ui/Skeleton";
import { Badge } from "../ui/Badge";
import { StateChip } from "../ui/StateChip";
import { sourceStatusChip, verdictChip } from "../ui/chips";
import { Dialog } from "../ui/Dialog";
import { Icon } from "../ui/Icon";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { termTitle } from "../../lib/terms";

function CopyQuote({ quote, url }: { quote?: string | null; url?: string | null }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  if (!quote) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url ? `"${quote}" (${url})` : `"${quote}"`);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 2000);
  };
  return (
    <div className="mt-2 flex items-center gap-2">
      <Button size="sm" onClick={() => void copy()} icon={<Icon name="Quote" size={14} aria-hidden />}>
        Copy quote with link
      </Button>
      <span role="status" className="text-sm text-text-muted">
        {state === "copied" ? "Copied" : state === "failed" ? "Copy is blocked in this browser" : ""}
      </span>
    </div>
  );
}

function ClaimEvidenceView({ runId, claimId }: { runId: string; claimId: string }) {
  const { load, retry } = useClaimEvidence(runId, claimId);
  const [now] = useState(() => new Date());

  if (load.status === "loading")
    return (
      <Card pad="sm" role="status" aria-live="polite" className="flex flex-col gap-3">
        <span className="sr-only">Loading evidence for {claimId}...</span>
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </Card>
    );
  if (load.status === "error")
    return (
      <div role="alert" className="text-bad-fg font-semibold flex items-center gap-2 bg-bad-bg p-3 rounded-md border border-bad-border">
        <Icon name="XOctagon" size={16} aria-hidden />
        <p className="flex-1">
          Could not load evidence for {claimId}: {load.message}
        </p>
        <button type="button" className="underline hover:text-bad-fg/80" onClick={retry}>
          Retry
        </button>
      </div>
    );
  const { claim, passage, source, origin, verdict } = load.data || {};
  const hl = highlightRanges(passage?.text || "", load.data?.quote_start, load.data?.quote_end, claim?.quote || "");
  const unestablished = load.data?.independence === "unestablished";
  const href = source?.url ? safeHref(source.url) : undefined;
  return (
    <Card as="article" pad="md" className="flex flex-col gap-4">
      <header>
        <p className="label mb-1">{termTitle("claim")} {claim?.id}</p>
        <h3 className="font-display text-xl font-semibold leading-snug">{claim?.text}</h3>
        <CopyQuote quote={claim?.quote} url={source?.url} />
        {claim?.value_num != null ? (
          <p className="text-base text-text-muted">
            {claim.entity ?? "?"} / {claim.attribute ?? "?"} = {claim.value_num} {claim.unit ?? ""}
            {claim.period ? ` per ${claim.period}` : ""}
          </p>
        ) : null}
      </header>
      <section aria-label="Verdict">
        {verdict ? (
          <div className="flex flex-wrap items-center gap-2">
            <StateChip spec={verdictChip(verdict)} />
            <span>{load.data?.verdict_rationale}</span>
          </div>
        ) : (
          <Badge>Not yet verified</Badge>
        )}
      </section>
      <section aria-label="Stored passage">
        <h4 className="label mb-1">
          Passage <span className="mono">{passage?.id}</span>{" "}
          <span className="text-sm font-normal text-text-muted">
            (source characters {passage?.char_start} to {passage?.char_end}
            {load.data?.quote_start != null ? `; quote at ${load.data.quote_start} to ${load.data.quote_end}` : ""})
          </span>
        </h4>
        <p className="rounded-md p-3 leading-relaxed bg-surface-2 whitespace-pre-wrap">
          {hl.segments.map((s, i) =>
            s.mark ? (
              <mark key={i} className="bg-warn-bg text-text border-b-[3px] border-warn-border px-0.5 font-semibold">
                {s.text}
              </mark>
            ) : (
              <span key={i}>{s.text}</span>
            ),
          )}
        </p>
        {!hl.located ? (
          <p role="alert" className="text-bad-fg flex items-center gap-1.5 mt-2 font-semibold">
            <Icon name="XOctagon" size={16} aria-hidden /> Quote could not be located in the stored passage.
          </p>
        ) : null}
      </section>
      <section aria-label={termTitle("origin")}>
        <h4 className="label mb-1">{termTitle("origin")}</h4>
        {origin ? (
          <p>
            {origin.label} <Badge>{methodText[origin.method ?? "none"]}</Badge>
          </p>
        ) : (
          <p className="text-text-muted">Independent source not yet assigned.</p>
        )}
        {unestablished ? (
          <p className="mt-1">
            <Badge title="Counts as one independent source for coverage.">{"? independence not established"}</Badge>
          </p>
        ) : null}
      </section>
      <section aria-label="Source">
        <h4 className="label mb-1">Source <span className="mono">{source?.id}</span></h4>
        <ul className="text-base flex flex-col gap-1">
          <li>
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className="underline hover:text-brand transition-colors">
                {source?.url}
              </a>
            ) : (
              <span>{source?.url} (not a web link)</span>
            )}
          </li>
          <li>
            {source?.domain} <Badge>{source?.source_type ?? "unknown"}</Badge> <Badge>{`Tier ${source?.authority_tier ?? 3}`}</Badge>
          </li>
          <li>
            Published: {source?.published_at ?? "unknown"} <Badge>{ageBucket(source?.published_at, now)}</Badge>
          </li>
          <li>Retrieved: {source?.retrieved_at ?? "unknown"}</li>
          <li>
            Status: <StateChip spec={sourceStatusChip(source?.status ?? "found")} />
            {source?.fail_reason ? <span className="text-bad-fg ml-1">{source.fail_reason}</span> : ""}
          </li>
        </ul>
      </section>
    </Card>
  );
}

/** Right drawer: claim, highlighted passage, verdict, origin, source (SSOT FR-24). Single instance via context. */
export function EvidenceDrawer() {
  const ev = useEvidence();
  const { runId } = useSession();
  const { close } = ev;
  const docked = useMediaQuery("(min-width: 1280px)");
  const { view } = useSession();
  const ids = useMemo(() => orderedClaimIds(Object.keys(view.claims)), [view.claims]);
  const current = ev.openIds.length === 1 ? ev.openIds[0] : undefined;
  const position = current ? ids.indexOf(current) : -1;
  const step = (dir: 1 | -1) => {
    const next = neighbourClaim(ids, current, dir);
    if (next) ev.open([next]);
  };

  useEffect(() => {
    if (!ev.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "j" || k === "k") {
        e.preventDefault();
        const next = neighbourClaim(ids, current, k === "j" ? 1 : -1);
        if (next) ev.open([next]);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev.isOpen, ids, current]);

  return (
    <Dialog
      isOpen={ev.isOpen}
      onClose={close}
      title="Evidence"
      placement="right"
      docked={docked}
    >
      {ev.isOpen && runId ? (
        <div className="flex flex-col gap-4 pb-8">
          {current && position >= 0 ? (
            <div className="flex items-center justify-between gap-2 text-sm text-text-muted">
              <span>
                Statement {position + 1} of {ids.length}
              </span>
              <span className="flex items-center gap-1">
                <Button
                  size="sm"
                  aria-label="Previous statement (K)"
                  title="Previous (K)"
                  disabled={position === 0}
                  onClick={() => step(-1)}
                  icon={<Icon name="ChevronUp" size={14} aria-hidden />}
                >
                  Prev
                </Button>
                <Button
                  size="sm"
                  aria-label="Next statement (J)"
                  title="Next (J)"
                  disabled={position === ids.length - 1}
                  onClick={() => step(1)}
                  icon={<Icon name="ChevronDown" size={14} aria-hidden />}
                >
                  Next
                </Button>
              </span>
            </div>
          ) : null}
          {ev.openIds.map((id) => (
            <ClaimEvidenceView key={`${runId}:${id}`} runId={runId} claimId={id} />
          ))}
        </div>
      ) : (
        <p className="text-text-muted">Select a statement or citation to see its stored passage, verdict, independent source and source.</p>
      )}
    </Dialog>
  );
}
