import { describe, expect, test } from "bun:test";
import type { Claim, ReportView } from "@contracts/types";
import { buildExportMarkdown } from "./reportExport";

const report = (over: Partial<ReportView> = {}): ReportView =>
  ({ run_id: "R1", version: 1, markdown: "# Title\n\nFinding [C2] and [C10].", citations: [], ...over }) as ReportView;

const claim = (id: string, quote: string) => ({ id, quote }) as unknown as Claim;

describe("buildExportMarkdown", () => {
  test("returns the stored report unchanged when nothing is cited", () => {
    expect(buildExportMarkdown(report(), {})).toBe("# Title\n\nFinding [C2] and [C10].\n");
  });

  test("appends a sources list in claim order with stored quotes and ids", () => {
    const out = buildExportMarkdown(
      report({
        citations: [
          { claim_id: "C10", passage_id: "P4", source_id: "S2", url: "https://b.example/x" },
          { claim_id: "C2", passage_id: "P1", source_id: "S1", url: "https://a.example/y" },
        ],
      }),
      { C2: claim("C2", "Two  words\nhere"), C10: claim("C10", "Ten") },
    );
    const list = out.split("## Sources cited")[1] ?? "";
    expect(list.indexOf("[C2]")).toBeLessThan(list.indexOf("[C10]"));
    expect(out).toContain('[C2] "Two words here" https://a.example/y (source S1, passage P1)');
  });

  test("a non-web url is labelled, never turned into a link", () => {
    const out = buildExportMarkdown(
      report({ citations: [{ claim_id: "C2", passage_id: "P1", source_id: "S1", url: "javascript:alert(1)" }] }),
      {},
    );
    expect(out).toContain("(not a web link)");
  });
});
