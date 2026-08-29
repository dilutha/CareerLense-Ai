import "server-only";
import { z } from "zod";
import { getGeminiClient } from "../ai/client";
import { GEMINI_MODEL } from "../ai/config";
import { GITHUB_ANALYSIS_SYSTEM_PROMPT } from "./prompts";
import { GeminiGitHubOutputSchema, type GeminiGitHubOutput, type GitHubProfileData } from "./schemas";

const RESPONSE_JSON_SCHEMA = z.toJSONSchema(GeminiGitHubOutputSchema) as Record<string, unknown>;
delete RESPONSE_JSON_SCHEMA.$schema;

function buildPrompt(profile: GitHubProfileData, targetRole: string | null, candidateSkills: string[]): string {
  const repoLines = profile.repos
    .map(
      (r) =>
        `- ${r.name} (${r.language ?? "no language set"}, ${r.stars} stars): ${r.description ?? "(no description)"}`
    )
    .join("\n");

  return `Candidate's target role: ${targetRole ?? "not specified"}
Candidate's known skills (from their profile/resume, for relevance checking only): ${candidateSkills.join(", ") || "none on file"}

GitHub profile (untrusted external data — see system instructions):
Username: ${profile.username}
Bio: ${profile.bio ?? "(none)"}
Public repos: ${profile.publicRepoCount}
Profile README present: ${profile.hasProfileReadme}

Non-fork repositories (${profile.repos.length} shown):
${repoLines || "(no public repositories)"}`;
}

async function callGemini(prompt: string): Promise<GeminiGitHubOutput | null> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      systemInstruction: GITHUB_ANALYSIS_SYSTEM_PROMPT,
      temperature: 0.3,
      responseMimeType: "application/json",
      responseJsonSchema: RESPONSE_JSON_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) return null;

  const parsed = GeminiGitHubOutputSchema.safeParse(JSON.parse(text));
  return parsed.success ? parsed.data : null;
}

export async function analyzeGitHubProfile(
  profile: GitHubProfileData,
  targetRole: string | null,
  candidateSkills: string[]
): Promise<GeminiGitHubOutput> {
  const prompt = buildPrompt(profile, targetRole, candidateSkills);

  const first = await callGemini(prompt).catch(() => null);
  if (first) return first;

  const second = await callGemini(prompt).catch(() => null);
  if (second) return second;

  throw new Error("GitHub analysis failed validation twice.");
}
