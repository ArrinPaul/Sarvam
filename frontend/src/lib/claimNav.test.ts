import { describe, expect, test } from "bun:test";
import { neighbourClaim, orderedClaimIds } from "./claimNav";

describe("claim navigation", () => {
  test("orders ids numerically, not as strings", () => {
    expect(orderedClaimIds(["C10", "C2", "C1"])).toEqual(["C1", "C2", "C10"]);
  });
  test("steps forward and back and stops at the ends", () => {
    const ids = ["C1", "C2", "C3"];
    expect(neighbourClaim(ids, "C2", 1)).toBe("C3");
    expect(neighbourClaim(ids, "C2", -1)).toBe("C1");
    expect(neighbourClaim(ids, "C3", 1)).toBeNull();
    expect(neighbourClaim(ids, "C1", -1)).toBeNull();
  });
  test("an unknown or missing current claim starts at the first; no claims gives null", () => {
    expect(neighbourClaim(["C1", "C2"], "C9", 1)).toBe("C1");
    expect(neighbourClaim(["C1", "C2"], undefined, -1)).toBe("C1");
    expect(neighbourClaim([], "C1", 1)).toBeNull();
  });
});
