import { describe, expect, it } from "vitest";
import { normalizeSerpApiJob } from "./serpapi";

describe("normalizeSerpApiJob", () => {
  it("normalizes a real-shaped result with a LinkedIn apply option", () => {
    const job = normalizeSerpApiJob({
      title: "Data Analyst Intern",
      company_name: "ABC Analytics",
      location: "Colombo, Sri Lanka",
      via: "via LinkedIn",
      description: "Join our analytics team...",
      job_id: "abc123",
      share_link: "https://www.google.com/search?ibp=htl;jobs&job_id=abc123",
      apply_options: [
        { title: "LinkedIn", link: "https://www.linkedin.com/jobs/view/12345" },
        { title: "Indeed", link: "https://www.indeed.com/viewjob?jk=xyz" },
      ],
      detected_extensions: { posted_at: "3 days ago", schedule_type: "Internship" },
    });

    expect(job).not.toBeNull();
    expect(job?.source).toBe("serpapi");
    expect(job?.sourceType).toBe("aggregator_result");
    expect(job?.sourceName).toBe("LinkedIn");
    // Uses the first https apply_options link, not Google's own share_link.
    expect(job?.applicationUrl).toBe("https://www.linkedin.com/jobs/view/12345");
    expect(job?.sourceJobId).toBe("abc123");
    expect(job?.employmentType).toBe("internship");
  });

  it("identifies a LinkedIn-origin job specifically via apply_options title", () => {
    const job = normalizeSerpApiJob({
      title: "Software Engineer",
      apply_options: [{ title: "LinkedIn", link: "https://www.linkedin.com/jobs/view/999" }],
    });
    expect(job?.sourceName).toBe("LinkedIn");
  });

  it("falls back to share_link when no apply_options link is present", () => {
    const job = normalizeSerpApiJob({
      title: "QA Engineer",
      share_link: "https://www.google.com/search?ibp=htl;jobs&job_id=xyz",
    });
    expect(job?.applicationUrl).toBe("https://www.google.com/search?ibp=htl;jobs&job_id=xyz");
  });

  it("rejects a result with no usable https application link — never fabricates one", () => {
    const job = normalizeSerpApiJob({ title: "No Link Job" });
    expect(job).toBeNull();
  });

  it("rejects a non-https apply link and falls back correctly", () => {
    const job = normalizeSerpApiJob({
      title: "Insecure Link Job",
      apply_options: [{ title: "Weird Source", link: "http://insecure.example.com/job" }],
      share_link: "https://www.google.com/search?ibp=htl;jobs&job_id=secure",
    });
    expect(job?.applicationUrl).toBe("https://www.google.com/search?ibp=htl;jobs&job_id=secure");
  });

  it("never invents a company name when SerpApi doesn't provide one", () => {
    const job = normalizeSerpApiJob({
      title: "Mystery Co Job",
      apply_options: [{ title: "Company", link: "https://example.com/job" }],
    });
    expect(job?.company).toBeNull();
  });

  it("infers remote work mode only from explicit text, never guesses", () => {
    const remote = normalizeSerpApiJob({
      title: "Remote Job",
      location: "Anywhere (Remote)",
      apply_options: [{ title: "X", link: "https://example.com/job1" }],
    });
    expect(remote?.workMode).toBe("remote");

    const unspecified = normalizeSerpApiJob({
      title: "Onsite-ish Job",
      location: "Colombo",
      apply_options: [{ title: "X", link: "https://example.com/job2" }],
    });
    expect(unspecified?.workMode).toBeNull();
  });

  it("leaves postedAt null when detected_extensions.posted_at is missing or unparseable", () => {
    const job = normalizeSerpApiJob({
      title: "No Date Job",
      apply_options: [{ title: "X", link: "https://example.com/job3" }],
    });
    expect(job?.postedAt).toBeNull();
  });
});
