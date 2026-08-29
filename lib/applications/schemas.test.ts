import { describe, expect, it } from "vitest";
import { APPLICATION_STATUSES, isValidApplicationStatus } from "./schemas";

describe("isValidApplicationStatus", () => {
  it("accepts every status in the pipeline", () => {
    for (const status of APPLICATION_STATUSES) {
      expect(isValidApplicationStatus(status)).toBe(true);
    }
  });

  it("rejects an arbitrary/unknown string", () => {
    expect(isValidApplicationStatus("hired")).toBe(false);
    expect(isValidApplicationStatus("")).toBe(false);
    expect(isValidApplicationStatus("Applied")).toBe(false); // case-sensitive
  });
});
