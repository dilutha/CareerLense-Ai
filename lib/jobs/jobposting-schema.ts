import "server-only";
import { htmlToPlainText } from "./html-strip";

/**
 * Extracts schema.org JobPosting structured data (JSON-LD) from a page's
 * HTML. This is data companies voluntarily embed on their own career pages
 * specifically so search engines (Google for Jobs and similar) can index
 * postings automatically — it's meant for exactly this kind of machine
 * consumption, not something that requires bypassing any protection. Used
 * by the company-careers provider and the "paste a job URL" import flow.
 *
 * Deliberately conservative: only fields the JobPosting object actually
 * states are extracted — nothing is inferred or guessed.
 */
export interface ExtractedJobPosting {
  title: string;
  company: string | null;
  location: string | null;
  description: string | null;
  employmentType: string | null;
  datePosted: string | null;
  applicationUrl: string | null;
  salaryText: string | null;
}

function textOf(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  return null;
}

function extractLocation(jobLocation: unknown): string | null {
  const loc = Array.isArray(jobLocation) ? jobLocation[0] : jobLocation;
  if (!loc || typeof loc !== "object") return textOf(loc);
  const address = (loc as { address?: unknown }).address;
  if (!address || typeof address !== "object") return null;
  const a = address as Record<string, unknown>;
  const parts = [a.addressLocality, a.addressRegion, a.addressCountry]
    .map(textOf)
    .filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(", ") : null;
}

function extractSalary(baseSalary: unknown): string | null {
  if (!baseSalary || typeof baseSalary !== "object") return null;
  const b = baseSalary as Record<string, unknown>;
  const currency = textOf(b.currency);
  const value = b.value;
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const min = textOf(v.minValue);
  const max = textOf(v.maxValue);
  const single = textOf(v.value);
  if (single) return [currency, single].filter(Boolean).join(" ");
  if (min && max) return [currency, `${min}-${max}`].filter(Boolean).join(" ");
  return null;
}

function toExtracted(node: Record<string, unknown>): ExtractedJobPosting | null {
  const title = textOf(node.title);
  if (!title) return null;

  const hiringOrg = node.hiringOrganization;
  const company =
    hiringOrg && typeof hiringOrg === "object" ? textOf((hiringOrg as Record<string, unknown>).name) : null;

  const rawDescription = textOf(node.description);

  return {
    title,
    company,
    location: extractLocation(node.jobLocation),
    description: rawDescription ? htmlToPlainText(rawDescription) : null,
    employmentType: textOf(node.employmentType),
    datePosted: textOf(node.datePosted),
    applicationUrl: textOf(node.url) ?? textOf((node.applicationContact as Record<string, unknown> | undefined)?.url),
    salaryText: extractSalary(node.baseSalary),
  };
}

/** Walks a parsed JSON-LD value looking for a node with @type "JobPosting". */
function findJobPostingNode(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJobPostingNode(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const type = obj["@type"];
    const isJobPosting = type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
    if (isJobPosting) return obj;
    if (Array.isArray(obj["@graph"])) {
      return findJobPostingNode(obj["@graph"]);
    }
  }
  return null;
}

/** Parses all <script type="application/ld+json"> blocks in `html` and
 *  returns the first JobPosting found, or null if none is present. */
export function extractJobPostingFromHtml(html: string): ExtractedJobPosting | null {
  const scriptPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptPattern.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      const node = findJobPostingNode(parsed);
      if (node) {
        const extracted = toExtracted(node);
        if (extracted) return extracted;
      }
    } catch {
      // Malformed JSON-LD on the page — skip this block, try the next.
      continue;
    }
  }

  return null;
}
