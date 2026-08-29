import { describe, expect, it } from "vitest";
import { matchApplicationByHint } from "./match-application";
import type { ApplicationWithJob } from "@/lib/applications/get-applications";

function app(id: string, companyName: string | null, title: string): ApplicationWithJob {
  return {
    application: {
      id, profile_id: "p1", job_id: `j-${id}`, application_document_id: null, status: "applied",
      notes: null, follow_up_date: null, interview_at: null, applied_at: null,
      last_status_changed_at: "", created_at: "", updated_at: "",
    },
    job: {
      id: `j-${id}`, source: "itpro", source_name: null, source_type: "job_board", source_job_id: null,
      title, company_name: companyName, location: null, country: "Sri Lanka", employment_type: null,
      work_mode: null, description: null, requirements: null, responsibilities: null, salary_text: null,
      application_url: "https://example.com", source_url: null, posted_at: null, expires_at: null,
      is_active: true, raw_data: null, normalized_data: null, content_hash: "h", first_seen_at: "",
      last_seen_at: "", listing_status: "active", duplicate_of: null, created_at: "", updated_at: "",
    },
    match: null,
  };
}

describe("matchApplicationByHint", () => {
  it("matches by company name, case-insensitively", () => {
    const apps = [app("1", "WSO2", "Software Engineer Intern")];
    expect(matchApplicationByHint("wso2", apps)?.application.id).toBe("1");
  });

  it("matches when the hint is a longer phrase containing the company name", () => {
    const apps = [app("1", "WSO2", "Software Engineer Intern")];
    expect(matchApplicationByHint("the wso2 application", apps)?.application.id).toBe("1");
  });

  it("matches by job title when no company matches", () => {
    const apps = [app("1", "Acme Corp", "Data Analyst Intern")];
    expect(matchApplicationByHint("data analyst", apps)?.application.id).toBe("1");
  });

  it("returns null when nothing matches — never guesses", () => {
    const apps = [app("1", "WSO2", "Software Engineer Intern")];
    expect(matchApplicationByHint("some other company", apps)).toBeNull();
  });

  it("returns null when multiple applications match ambiguously", () => {
    const apps = [app("1", "Acme Corp", "Data Analyst"), app("2", "Acme Industries", "Data Engineer")];
    expect(matchApplicationByHint("acme", apps)).toBeNull();
  });

  it("returns null for an empty hint", () => {
    const apps = [app("1", "WSO2", "Software Engineer Intern")];
    expect(matchApplicationByHint("", apps)).toBeNull();
  });
});
