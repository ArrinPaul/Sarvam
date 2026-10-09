import type { Claim, ReportView } from "@contracts/types";
import { safeHref } from "./format";

const idNumber = (id: string) => Number(id.replace(/\D/g, "")) || 0;

/**
 * The report as a shareable Markdown file: the stored report text, then a "Sources cited" list so
 * every [C#] marker resolves without the app. Everything comes from stored IDs and stored quotes;
 * nothing is typed in by the model or the browser.
 */
export function buildExportMarkdown(report: ReportView, claims: Record<string, Claim>): string {
  const cites = [...(report.citations ?? [])].sort((a, b) => idNumber(a.claim_id) - idNumber(b.claim_id));
  const body = report.markdown.trimEnd();
  if (cites.length === 0) return `${body}\n`;
  const lines = cites.map((c) => {
    const quote = claims[c.claim_id]?.quote?.replace(/\s+/g, " ").trim();
    const url = safeHref(c.url);
    const where = url ?? `${c.url} (not a web link)`;
    return `- [${c.claim_id}] ${quote ? `"${quote}" ` : ""}${where} (source ${c.source_id}, passage ${c.passage_id})`;
  });
  return `${body}\n\n## Sources cited\n\n${lines.join("\n")}\n`;
}
