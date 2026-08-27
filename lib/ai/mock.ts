import type { ChatReply } from "./types";

type IntentKey =
  | "internshipGeneric"
  | "internshipSpecific"
  | "cvCheck"
  | "portfolioReview"
  | "interviewPractice"
  | "coverLetter"
  | "matching"
  | "fallback";

const INTENT_REPLIES: Record<IntentKey, ChatReply> = {
  internshipGeneric: {
    steps: [
      {
        kind: "text",
        content: `Ado ela 😎

Internship ekak hoyamu.

First CV eka thiyenawanam upload karapan. Portfolio link ekak thiyenawanam ekath dapan.

Nethnam awulak na — mama tikak questions ahala profile eka hadagannam.`,
      },
    ],
  },
  internshipSpecific: {
    steps: [
      { kind: "text", content: "Ado ela 🔎 **Data Analyst** internships balamu." },
      { kind: "tool_status", toolStatus: "searching_jobs" },
      {
        kind: "job_preview",
        title: "What I'll check",
        items: [
          "Your education",
          "Your technical skills",
          "Your projects",
          "Your preferred location",
        ],
      },
      {
        kind: "text",
        content:
          "CV eka thiyenawanam dapan. Eken match eka godak accurate wenawa.",
      },
    ],
  },
  cvCheck: {
    steps: [
      { kind: "text", content: "Sure 👌\n\n**CV eka** upload karapan. Mama check karannam:" },
      { kind: "tool_status", toolStatus: "analyzing_resume" },
      {
        kind: "resume_analysis",
        title: "What I'll check",
        items: [
          "Skills",
          "Projects",
          "Experience",
          "ATS readability",
          "Job relevance",
        ],
      },
    ],
  },
  portfolioReview: {
    steps: [
      {
        kind: "text",
        content:
          "Nice 🌐\n\nPortfolio link eka dapan. Balamu mokak improve karanna puluwanda kiyala.",
      },
      { kind: "tool_status", toolStatus: "analyzing_portfolio" },
      {
        kind: "text",
        content:
          "Once I can see it, mama check karannam project evidence, role clarity, saha basic SEO.",
      },
    ],
  },
  interviewPractice: {
    steps: [
      {
        kind: "text",
        content: `Ready da? 🎤

Interview practice karamu.

Eka role ekak select karapan — eeta match wena questions dennam. Introduction, behavioral, technical — okkoma cover karamu.`,
      },
    ],
  },
  coverLetter: {
    steps: [
      {
        kind: "text",
        content:
          "Cover letter ekak hadamu ✍️\n\nJob eka saha oyage CV eka dennawanam, mama company ekata customize karala professional letter ekak generate karannam.",
      },
    ],
  },
  matching: {
    steps: [
      {
        kind: "text",
        content:
          "Match eka check karanna mula job eka pick karapan.\n\nEeta passe CV eka saha job requirements compare karala explain karannam — strong matches, gaps, okkoma.",
      },
    ],
  },
  fallback: {
    steps: [
      {
        kind: "text",
        content: `Adooo 👋 mata kiyapan — internship ekak hoyanna one da, CV eka check karanna one da, portfolio balanna one da, nattam interview practice karanna one da?

Sinhala, Singlish, English — mokak hari kiyapan.`,
      },
    ],
  },
};

/**
 * Local mock reply generator. No longer used by the live chat path — real
 * conversations go through the Gemini-backed career agent via
 * `lib/ai/chat-client.ts`. Kept for isolated UI development/testing when
 * you don't want to spend Gemini API calls (e.g. `getMockReply` in a quick
 * script or a future dev-only toggle).
 */
export function getMockReply(userText: string): ChatReply {
  const text = userText.toLowerCase();

  if (text.includes("trigger error") || text.includes("simulate error")) {
    throw new Error("mock failure");
  }

  const mentionsInternshipOrJob = /internship|\bjob\b/.test(text);
  const mentionsDataAnalyst = text.includes("data analyst");
  const mentionsColombo = text.includes("colombo");

  if (mentionsInternshipOrJob && (mentionsDataAnalyst || mentionsColombo)) {
    return INTENT_REPLIES.internshipSpecific;
  }
  if (mentionsInternshipOrJob) {
    return INTENT_REPLIES.internshipGeneric;
  }
  if (/\bcv\b|resume/.test(text)) {
    return INTENT_REPLIES.cvCheck;
  }
  if (text.includes("portfolio")) {
    return INTENT_REPLIES.portfolioReview;
  }
  if (text.includes("interview")) {
    return INTENT_REPLIES.interviewPractice;
  }
  if (text.includes("cover letter")) {
    return INTENT_REPLIES.coverLetter;
  }
  if (text.includes("match")) {
    return INTENT_REPLIES.matching;
  }
  return INTENT_REPLIES.fallback;
}
