import { describe, expect, it } from "vitest";
import { extractFirstUrl } from "./analyze-url";

describe("extractFirstUrl", () => {
  it("finds a URL that is the whole message", () => {
    expect(extractFirstUrl("https://xpress.jobs/jobs/view/309548/data-analyst-dialog-axiata-plc")).toBe(
      "https://xpress.jobs/jobs/view/309548/data-analyst-dialog-axiata-plc"
    );
  });

  it("finds a URL embedded in surrounding text", () => {
    expect(extractFirstUrl("check this out https://itpro.lk/job/123/role/ looks good")).toBe(
      "https://itpro.lk/job/123/role/"
    );
  });

  it("returns null when there's no URL", () => {
    expect(extractFirstUrl("find me an internship")).toBeNull();
  });

  it("does not match a bare domain without a scheme", () => {
    expect(extractFirstUrl("go check xpress.jobs")).toBeNull();
  });

  it("stops at trailing punctuation/quotes rather than swallowing it", () => {
    expect(extractFirstUrl('here: "https://example.com/job/1"')).toBe("https://example.com/job/1");
    expect(extractFirstUrl("(https://example.com/job/2)")).toBe("https://example.com/job/2");
  });

  it("finds the first of multiple URLs", () => {
    expect(extractFirstUrl("https://a.com/1 https://b.com/2")).toBe("https://a.com/1");
  });
});
