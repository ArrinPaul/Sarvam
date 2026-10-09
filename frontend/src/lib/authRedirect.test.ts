import { describe, expect, test } from "bun:test";
import { postAuthDestination } from "./authRedirect";

describe("postAuthDestination", () => {
  test("admins land on the operator console by default", () => {
    expect(postAuthDestination("admin", null)).toBe("#/admin");
    expect(postAuthDestination("admin", "")).toBe("#/admin");
    expect(postAuthDestination("admin", "#/workspace")).toBe("#/admin");
    expect(postAuthDestination("admin", "#/new")).toBe("#/admin");
  });
  test("an admin who was heading to a specific page still gets there", () => {
    expect(postAuthDestination("admin", "#/run/R1/report")).toBe("#/run/R1/report");
    expect(postAuthDestination("admin", "#/account")).toBe("#/account");
  });
  test("regular users keep the workspace default and their stored destination", () => {
    expect(postAuthDestination("user", null)).toBe("#/workspace");
    expect(postAuthDestination("user", "#/run/R1")).toBe("#/run/R1");
    expect(postAuthDestination("user", "#/admin")).toBe("#/admin"); // the console guard handles 403
  });
});
