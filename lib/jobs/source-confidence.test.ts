import { describe, expect, it } from "vitest";
import { getSourceConfidence } from "./source-confidence";

describe("getSourceConfidence", () => {
  it("rates a direct API (ITPro, job_board) and a self-fetched official page as HIGH", () => {
    expect(getSourceConfidence("job_board")).toBe("HIGH");
    expect(getSourceConfidence("official_company")).toBe("HIGH");
  });

  it("rates an aggregator result (SerpApi/Google Jobs) as MEDIUM, not HIGH — resolution isn't guaranteed", () => {
    expect(getSourceConfidence("aggregator_result")).toBe("MEDIUM");
  });

  it("rates fixture/demo data as LOW", () => {
    expect(getSourceConfidence("fixture")).toBe("LOW");
  });
});
