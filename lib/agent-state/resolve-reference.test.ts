import { describe, expect, it } from "vitest";
import { resolveJobReference } from "./resolve-reference";

describe("resolveJobReference", () => {
  const lastResultJobIds = ["job-a", "job-b", "job-c"];

  it("resolves 'second eka' (index 2) to the second job ID", () => {
    expect(resolveJobReference(2, lastResultJobIds)).toBe("job-b");
  });

  it("resolves 'first eka' (index 1) to the first job ID", () => {
    expect(resolveJobReference(1, lastResultJobIds)).toBe("job-a");
  });

  it("returns null for a null index (no reference made)", () => {
    expect(resolveJobReference(null, lastResultJobIds)).toBeNull();
  });

  it("returns null rather than guessing for an out-of-range index", () => {
    expect(resolveJobReference(5, lastResultJobIds)).toBeNull();
  });

  it("returns null when there are no previous results at all", () => {
    expect(resolveJobReference(1, [])).toBeNull();
  });
});
