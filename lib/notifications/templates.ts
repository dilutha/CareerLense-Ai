import type { ApplicationStatus } from "@/lib/applications/schemas";
import { APPLICATION_STATUS_LABELS } from "@/lib/applications/schemas";

export interface NotificationContent {
  title: string;
  message: string;
}

/**
 * All notification text is a fixed template, never a Gemini call (Part 5:
 * "Do NOT use Gemini for simple scheduling logic") — friendly,
 * Sinhala/Singlish/English-mixed tone matching CareerLens's established
 * chat personality (lib/ai/prompts.ts), never manipulative or falsely
 * emotional (Part 8).
 */

function companyLabel(companyName: string | null): string {
  return companyName?.trim() || "this company";
}

export function buildFollowUpReminder(jobTitle: string, companyName: string | null): NotificationContent {
  const company = companyLabel(companyName);
  return {
    title: `Follow up with ${company}`,
    message: `Machan, ${company} application eka (${jobTitle}) follow-up karanna ada hari 👍`,
  };
}

export function buildInterviewReminder(
  jobTitle: string,
  companyName: string | null,
  leadTime: "24h" | "1h"
): NotificationContent {
  const company = companyLabel(companyName);
  if (leadTime === "24h") {
    return {
      title: `Tomorrow — interview at ${company}`,
      message: `Tomorrow — interview at ${company} (${jobTitle}). Prep karala ready wenna, /interview eken practice karanna puluwan.`,
    };
  }
  return {
    title: `1 hour left — ${company} interview`,
    message: `1 hour left — ${company} interview (${jobTitle}). Hari machan, oyata puluwan 💪`,
  };
}

export function buildDeadlineReminder(jobTitle: string, companyName: string | null, daysLeft: number): NotificationContent {
  const company = companyLabel(companyName);
  const dayWord = daysLeft <= 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;
  return {
    title: `${company} application closes ${dayWord}`,
    message: `Machan, ${jobTitle} at ${company} eka close wenna ${daysLeft <= 0 ? "ada" : `thawa dawas ${daysLeft}i`}. Apply karanna balanna.`,
  };
}

const POSITIVE_STATUSES: ApplicationStatus[] = ["screening", "interview", "final_round", "offer"];

export function buildStatusChangeNotification(
  jobTitle: string,
  companyName: string | null,
  oldStatus: ApplicationStatus | null,
  newStatus: ApplicationStatus
): NotificationContent {
  const company = companyLabel(companyName);
  const newLabel = APPLICATION_STATUS_LABELS[newStatus];

  if (newStatus === "offer") {
    return {
      title: `🎉 Offer from ${company}!`,
      message: `Ado nice! 🎉 ${company} eken offer ekak ${jobTitle} ekata. Congratulations machan!`,
    };
  }

  if (newStatus === "rejected") {
    return {
      title: `Update from ${company}`,
      message: `Me application eka (${jobTitle}, ${company}) hari giye na machan. Awulak na — balamu mokak improve karanna puluwanda next applications walata.`,
    };
  }

  if (POSITIVE_STATUSES.includes(newStatus)) {
    return {
      title: `${company} moved to ${newLabel}`,
      message: `Ado nice! 🎉 Your ${company} application (${jobTitle}) moved to ${newLabel}. Let's get you ready.`,
    };
  }

  return {
    title: `${company} status: ${newLabel}`,
    message: `${jobTitle} at ${company} eka dan "${newLabel}" widihata update una.`,
  };
}
