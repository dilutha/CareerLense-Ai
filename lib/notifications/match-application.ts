import type { ApplicationWithJob } from "@/lib/applications/get-applications";

/**
 * Matches a free-text hint (a company name or role, from
 * lib/notifications/intent.ts's applicationHint) against the user's own
 * tracked applications — case-insensitive substring match against
 * company name and job title. Returns a match only when EXACTLY ONE
 * application matches; zero or multiple matches return null so the
 * caller asks the user to clarify rather than guessing which job they
 * meant (Part 11: "ask a clarification question only when necessary").
 */
export function matchApplicationByHint(hint: string, applications: ApplicationWithJob[]): ApplicationWithJob | null {
  const needle = hint.trim().toLowerCase();
  if (!needle) return null;

  const matches = applications.filter((a) => {
    const company = a.job.company_name?.toLowerCase() ?? "";
    const title = a.job.title.toLowerCase();
    const companyMatches = company.length > 0 && (company.includes(needle) || needle.includes(company));
    return companyMatches || title.includes(needle);
  });

  return matches.length === 1 ? matches[0] : null;
}
