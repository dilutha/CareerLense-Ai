import "server-only";
import type { SourceRegistryEntry } from "./types";

/**
 * Every job source CareerLens knows about — not just the ones actively
 * queried by getActiveProviders(). Used for the /jobs source filter UI and
 * docs/JOB_DATA.md's status table, so the UI never has to invent a source
 * name or silently omit a limitation. Static for Phase 9 (no scheduled
 * ingestion job exists yet to update `status` from real-time health
 * checks) — see docs/JOB_DATA.md for the verified reasoning behind each
 * entry's status.
 */
export const SOURCE_REGISTRY: SourceRegistryEntry[] = [
  {
    key: "itpro",
    name: "ITPro.lk",
    region: "Sri Lanka",
    accessMethod: "api",
    status: "available",
    automatedSearch: true,
    statusReason: "Public JSON API (GET /api/v1/jobs), verified working with live data, no key required for reads.",
  },
  {
    key: "company-careers",
    name: "Company Careers",
    region: "Sri Lanka / Global",
    accessMethod: "structured_data",
    status: "configuration_required",
    automatedSearch: true,
    statusReason:
      "Mechanism works (schema.org JobPosting extraction, robots.txt-respecting) but no company career page is verified/seeded yet — WSO2 and Virtusa were checked and returned 403 (bot-protected).",
  },
  {
    key: "xpressjobs",
    name: "XpressJobs",
    region: "Sri Lanka",
    accessMethod: "manual_external",
    status: "unavailable",
    automatedSearch: false,
    statusReason:
      "robots.txt fully permits crawling, but no public API or structured job data was found — automated extraction would mean guessing HTML structure, which this project avoids. Paste a job URL/description instead.",
  },
  {
    key: "ikman",
    name: "ikman.lk Jobs",
    region: "Sri Lanka",
    accessMethod: "manual_external",
    status: "unavailable",
    automatedSearch: false,
    statusReason:
      "robots.txt doesn't block /jobs, but no public API or structured job data was found. Paste a job URL/description instead.",
  },
  {
    key: "linkedin",
    name: "LinkedIn",
    region: "Global",
    accessMethod: "manual_external",
    status: "blocked",
    automatedSearch: false,
    statusReason:
      "LinkedIn's Terms of Service prohibit automated scraping, and their Jobs API requires partner approval, not self-serve access. Open LinkedIn Jobs externally, or paste a job URL/description to analyze.",
  },
  {
    key: "serpapi",
    name: "SerpApi Google Jobs",
    region: "Global",
    accessMethod: "api",
    status: "configuration_required",
    automatedSearch: true,
    statusReason:
      "Real implementation (Google Jobs aggregation — surfaces LinkedIn/Indeed/company-site listings via their own apply links), verified against SerpApi's documentation. No SERPAPI_API_KEY is configured yet.",
  },
  {
    key: "demo",
    name: "Demo Data",
    region: "N/A",
    accessMethod: "fixture",
    status: "available",
    automatedSearch: true,
    statusReason: "Fictional fixture listings for local development — never mixed with real results without a visible label.",
  },
];

export function getSourceRegistryEntry(key: string): SourceRegistryEntry | undefined {
  return SOURCE_REGISTRY.find((s) => s.key === key);
}
