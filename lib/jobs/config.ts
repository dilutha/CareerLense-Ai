/**
 * Centralized, transparent match weighting — see docs/AI_AGENT.md for the
 * full formula. Never scatter magic numbers across the matching code.
 */
export const JOB_MATCH_WEIGHTS = {
  skills: 0.35,
  role: 0.2,
  experience: 0.15,
  education: 0.1,
  location: 0.1,
  keywords: 0.1,
} as const;

export const MATCH_CATEGORY_THRESHOLDS = {
  excellent: 90,
  good: 75,
  potential: 60,
} as const;

export const DEFAULT_SEARCH_RESULT_LIMIT = 20;
export const MAX_RANKED_RESULTS = 15;

/**
 * Chat's conversational job results deliberately show far fewer than the
 * full /jobs search page (PROJECT_SPEC "top 4-5, not 50, not 100") — the
 * chat picks its top CHAT_RESULT_COUNT from whatever clears
 * CHAT_QUALITY_FLOOR, and never pads with weak matches just to fill the
 * count (see lib/jobs/actions.ts#selectChatResults).
 */
export const CHAT_RESULT_COUNT = 5;
export const CHAT_QUALITY_FLOOR = MATCH_CATEGORY_THRESHOLDS.potential; // 60
export const CHAT_RESULT_FALLBACK_COUNT = 3;
