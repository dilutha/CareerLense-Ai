import { describe, expect, it } from "vitest";
import { inferEmploymentType, inferWorkMode, toNormalizedJob, type ItProJob } from "./itpro";

const baseRaw: ItProJob = {
  id: "14792",
  title: "Motion Graphic Designer / Video Editor",
  description: "<p>Great <strong>role</strong> with <ul><li>benefits</li></ul></p>",
  summary: "Join Innobot Health as a Motion Graphic Designer in Colombo, Full-time. Apply now on ITPro.lk.",
  type_id: "1",
  category_id: "27",
  location: "79",
  company: "Innobot Health",
  website: "https://innobothealth.com",
  views_count: "38",
  created_on: "2026-08-28 11:48:20",
};

describe("itpro toNormalizedJob", () => {
  it("normalizes a real-shaped API response", () => {
    const job = toNormalizedJob(baseRaw);
    expect(job).not.toBeNull();
    expect(job?.source).toBe("itpro");
    expect(job?.sourceJobId).toBe("14792");
    expect(job?.title).toBe(baseRaw.title);
    expect(job?.company).toBe("Innobot Health");
    // Numeric location code has no public mapping — never guessed.
    expect(job?.location).toBeNull();
    expect(job?.applicationUrl).toMatch(/^https:\/\/itpro\.lk\/job\/14792\//);
    expect(job?.sourceUrl).toBe(job?.applicationUrl);
  });

  it("strips HTML from the description", () => {
    const job = toNormalizedJob(baseRaw);
    expect(job?.description).not.toContain("<p>");
    expect(job?.description).not.toContain("<strong>");
    expect(job?.description).toContain("Great");
    expect(job?.description).toContain("benefits");
  });

  it("infers employment type only from literal keywords in the source's own text, never guesses", () => {
    expect(inferEmploymentType("Full-time role in Colombo")).toBe("full_time");
    expect(inferEmploymentType("This is an Internship opportunity")).toBe("internship");
    expect(inferEmploymentType("Nothing about hours here")).toBeNull();
  });

  it("infers work mode only from literal keywords", () => {
    expect(inferWorkMode("100% Remote position")).toBe("remote");
    expect(inferWorkMode("Hybrid work available")).toBe("hybrid");
    expect(inferWorkMode("No mode mentioned")).toBeNull();
  });

  it("rejects a malformed API response missing required fields", () => {
    const malformed = { ...baseRaw, id: "", title: "" } as ItProJob;
    expect(toNormalizedJob(malformed)).toBeNull();
  });

  it("rejects a response with a completely missing title", () => {
    const rest: Partial<ItProJob> = { ...baseRaw };
    delete rest.title;
    const malformed = rest as unknown as ItProJob;
    expect(toNormalizedJob(malformed)).toBeNull();
  });

  it("never invents a company name when the API doesn't provide one", () => {
    const job = toNormalizedJob({ ...baseRaw, company: null });
    expect(job?.company).toBeNull();
  });
});
