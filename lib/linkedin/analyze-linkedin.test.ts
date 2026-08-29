import { describe, expect, it } from "vitest";
import { validatePastedContent } from "./analyze-linkedin";

describe("validatePastedContent", () => {
  it("rejects content that's too short", () => {
    const result = validatePastedContent("Student");
    expect(result.valid).toBe(false);
  });

  it("rejects content that's implausibly long", () => {
    const result = validatePastedContent("a".repeat(7000));
    expect(result.valid).toBe(false);
  });

  it("accepts a reasonable pasted profile", () => {
    const result = validatePastedContent(
      "Data Science Undergraduate | Python, SQL, ML. About: I'm a final-year student building data pipelines and dashboards."
    );
    expect(result.valid).toBe(true);
  });
});
