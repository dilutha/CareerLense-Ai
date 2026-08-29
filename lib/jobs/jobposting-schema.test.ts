import { describe, expect, it } from "vitest";
import { extractJobPostingFromHtml } from "./jobposting-schema";

function pageWithJsonLd(json: unknown): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify(json)}</script></head><body>hi</body></html>`;
}

describe("extractJobPostingFromHtml", () => {
  it("extracts a well-formed JobPosting", () => {
    const html = pageWithJsonLd({
      "@context": "https://schema.org/",
      "@type": "JobPosting",
      title: "Software Engineer Intern",
      description: "<p>Build things.</p>",
      hiringOrganization: { "@type": "Organization", name: "Acme Corp" },
      jobLocation: {
        "@type": "Place",
        address: { addressLocality: "Colombo", addressCountry: "LK" },
      },
      employmentType: "INTERN",
      datePosted: "2026-08-01",
      baseSalary: {
        "@type": "MonetaryAmount",
        currency: "LKR",
        value: { "@type": "QuantitativeValue", minValue: 50000, maxValue: 80000 },
      },
    });

    const result = extractJobPostingFromHtml(html);
    expect(result).not.toBeNull();
    expect(result?.title).toBe("Software Engineer Intern");
    expect(result?.company).toBe("Acme Corp");
    expect(result?.location).toContain("Colombo");
    expect(result?.description).toContain("Build things.");
    expect(result?.description).not.toContain("<p>");
    expect(result?.employmentType).toBe("INTERN");
    expect(result?.salaryText).toContain("50000");
  });

  it("returns null when there's no JSON-LD at all", () => {
    expect(extractJobPostingFromHtml("<html><body>No structured data here.</body></html>")).toBeNull();
  });

  it("returns null when JSON-LD exists but isn't a JobPosting", () => {
    const html = pageWithJsonLd({ "@type": "Organization", name: "Acme Corp" });
    expect(extractJobPostingFromHtml(html)).toBeNull();
  });

  it("finds a JobPosting inside an @graph array", () => {
    const html = pageWithJsonLd({
      "@context": "https://schema.org/",
      "@graph": [
        { "@type": "Organization", name: "Acme Corp" },
        { "@type": "JobPosting", title: "Data Analyst" },
      ],
    });
    const result = extractJobPostingFromHtml(html);
    expect(result?.title).toBe("Data Analyst");
  });

  it("does not throw on malformed JSON-LD, and returns null", () => {
    const html = `<html><head><script type="application/ld+json">{not valid json</script></head></html>`;
    expect(extractJobPostingFromHtml(html)).toBeNull();
  });

  it("never invents a field the JobPosting object doesn't state", () => {
    const html = pageWithJsonLd({ "@type": "JobPosting", title: "Minimal Posting" });
    const result = extractJobPostingFromHtml(html);
    expect(result?.company).toBeNull();
    expect(result?.location).toBeNull();
    expect(result?.salaryText).toBeNull();
  });
});
