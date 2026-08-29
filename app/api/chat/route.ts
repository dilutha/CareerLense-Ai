import { NextResponse } from "next/server";
import { streamCareerAgentReply } from "@/lib/ai/career-agent";
import { MAX_HISTORY_MESSAGES, MAX_MESSAGE_LENGTH } from "@/lib/ai/config";
import type { AgentMessage, ChatRole, ChatStreamEvent } from "@/lib/ai/types";
import { getCareerProfile } from "@/lib/career-profile/get-profile";
import { buildCareerContext } from "@/lib/career-profile/profile-context";
import { buildCareerReadinessContext } from "@/lib/career/chat-context";
import { getCareerReadinessSnapshot } from "@/lib/career/get-career";
import { buildApplicationsContext } from "@/lib/applications/chat-context";
import { computeAnalyticsSummary } from "@/lib/applications/analytics-summary";
import { getApplicationsForUser, type ApplicationWithJob } from "@/lib/applications/get-applications";
import { computeApplicationStats } from "@/lib/applications/stats";
import type { ApplicationStatusHistoryRow } from "@/lib/applications/types";
import { setFollowUpDate, setInterviewAt } from "@/lib/applications/actions";
import { extractReminderIntent, looksLikeReminderMessage } from "@/lib/notifications/intent";
import { matchApplicationByHint } from "@/lib/notifications/match-application";
import { parseReminderDateTime } from "@/lib/notifications/parse-datetime";
import { searchJobsForCurrentUser } from "@/lib/jobs/actions";
import { selectChatResults } from "@/lib/jobs/rank";
import { buildJobResultsContext, toJobResultSummary, type JobResultSummary } from "@/lib/jobs/summary";
import { buildResumeContext } from "@/lib/resume/get-resume-context";
import { getOrCreateConversation, saveMessage } from "@/lib/chat/persist";
import { getAgentState, saveAgentState } from "@/lib/agent-state/persist";
import { emptyAgentState, type CareerAgentState } from "@/lib/agent-state/schema";
import { shouldExtractStateUpdate, extractStateUpdate } from "@/lib/agent-state/extract-update";
import { mergeAgentState } from "@/lib/agent-state/merge";
import { resolveJobReference } from "@/lib/agent-state/resolve-reference";
import { updateAffectsSearch } from "@/lib/agent-state/update-affects-search";
import { buildSearchCriteria } from "@/lib/agent-state/build-search-criteria";
import { applyConversationalFilters } from "@/lib/agent-state/apply-filters";
import { buildAgentStateContext, buildSelectedJobContext } from "@/lib/agent-state/build-context";
import { getJobsByIds } from "@/lib/agent-state/get-jobs-by-ids";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const VALID_ROLES: ChatRole[] = ["user", "assistant", "system"];

function isAbortError(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === "AbortError";
}

/** Concise, single-line error description safe for server logs. */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseMessages(body: unknown): AgentMessage[] | null {
  if (
    typeof body !== "object" ||
    body === null ||
    !("messages" in body) ||
    !Array.isArray((body as { messages: unknown }).messages)
  ) {
    return null;
  }

  const rawMessages = (body as { messages: unknown[] }).messages;

  // Generous upper bound — the agent itself only uses the last
  // MAX_HISTORY_MESSAGES, this just guards against absurd payloads.
  if (rawMessages.length === 0 || rawMessages.length > MAX_HISTORY_MESSAGES * 4) {
    return null;
  }

  const messages: AgentMessage[] = [];
  for (const raw of rawMessages) {
    if (typeof raw !== "object" || raw === null) return null;

    const { id, role, content } = raw as Record<string, unknown>;
    if (typeof role !== "string" || !VALID_ROLES.includes(role as ChatRole)) {
      return null;
    }
    if (typeof content !== "string") return null;

    const trimmed = content.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_MESSAGE_LENGTH) return null;

    messages.push({
      id: typeof id === "string" && id.length > 0 ? id : crypto.randomUUID(),
      role: role as ChatRole,
      content: trimmed,
    });
  }

  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role !== "user") return null;

  return messages;
}

/** null = "start a new conversation"; a string is only trusted after getOrCreateConversation verifies ownership. */
function parseConversationId(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("conversationId" in body)) return null;
  const value = (body as { conversationId: unknown }).conversationId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Phase 21 — the stateful career-agent turn. Replaces the old one-shot
 * "does this message ask for a job search" gate (which had no memory
 * across turns, so a pure refinement message like "international company
 * ekak nam hodai" — no job-search keyword in it at all — would never
 * even trigger extraction). Pipeline (PROJECT_SPEC's own Part 18):
 *
 *   user message -> extract state UPDATE (Gemini, structured, retried
 *   once) -> merge onto persisted state (deterministic) -> resolve any
 *   "first/second" reference against the LAST shown result IDs
 *   (deterministic) -> if this update actually changes something
 *   search-relevant, build a JobSearchQuery from state and run it through
 *   the EXISTING discovery+matching pipeline unchanged -> apply
 *   deterministic conversational filters/dedup -> rank -> top 4-5.
 *
 * Never throws — a failed extraction or search just means this turn
 * continues without a state update or new results; the conversational
 * reply still proceeds normally on whatever state already existed.
 */
interface CareerAgentTurnOutcome {
  state: CareerAgentState;
  stateChanged: boolean;
  jobResultsForClient: JobResultSummary[];
  jobContext: string | undefined;
  agentStateContext: string | undefined;
  toolStatus: "searching_jobs" | "matching_job" | null;
}

async function runCareerAgentTurn(
  userId: string,
  userText: string,
  currentState: CareerAgentState,
  careerContext: string | undefined
): Promise<CareerAgentTurnOutcome> {
  const noOp: CareerAgentTurnOutcome = {
    state: currentState,
    stateChanged: false,
    jobResultsForClient: [],
    jobContext: undefined,
    agentStateContext: buildAgentStateContext(currentState) ?? undefined,
    toolStatus: null,
  };

  if (!shouldExtractStateUpdate(userText, currentState)) return noOp;

  const update = await extractStateUpdate(userText, currentState, careerContext ?? null);
  if (!update) return noOp;

  let state = mergeAgentState(currentState, update);

  const referencedJobId = resolveJobReference(update.referencedResultIndex, currentState.lastResultJobIds);
  if (referencedJobId) state = { ...state, selectedJobId: referencedJobId };

  const searchRelevant = updateAffectsSearch(update);
  const canSearch = state.intent === "job_search" && Boolean(state.targetRole);

  let jobResultsForClient: JobResultSummary[] = [];
  let jobContext: string | undefined;
  let toolStatus: CareerAgentTurnOutcome["toolStatus"] = null;

  if (canSearch && searchRelevant) {
    toolStatus = "searching_jobs";
    const criteria = buildSearchCriteria(state, 20);
    const response = await searchJobsForCurrentUser(criteria);

    if (!("error" in response)) {
      const excludeIds = update.wantsMoreResults ? currentState.lastResultJobIds : [];
      const filtered = applyConversationalFilters(response.results, state, excludeIds);
      const { results, belowQualityBar } = selectChatResults(filtered);
      const summaries = results.map((r) => toJobResultSummary(r, r.job.source === "demo"));

      jobResultsForClient = summaries;
      jobContext = buildJobResultsContext(summaries) ?? undefined;
      if (summaries.length === 0) {
        jobContext =
          "The user's refined job search returned nothing this time (not a fabricated-vs-real issue — genuinely nothing matched the current criteria, or every source was unavailable). Tell them honestly and suggest loosening a specific constraint (location, company type, seniority) — never invent listings to fill the gap.";
      } else if (belowQualityBar) {
        jobContext = `${jobContext}\n\nNote: these aren't strong matches (below the usual quality bar) — say so honestly rather than presenting them as great fits.`;
      }

      state = { ...state, lastResultJobIds: summaries.map((s) => s.id), lastSearchAt: new Date().toISOString() };
    } else {
      jobContext =
        "A job search was attempted for the user's refined criteria but the search itself failed (a provider/config issue, not zero results). Tell them honestly that something went wrong on the search side and offer to try again — never invent listings.";
    }
  } else if (state.selectedJobId) {
    // A reference/detail question about an already-selected job, not a
    // new search — ground the reply in that specific job's real data
    // (Part 22) instead of re-searching or guessing.
    toolStatus = "matching_job";
    const [selected] = await getJobsByIds(userId, [state.selectedJobId]);
    if (selected) {
      jobContext = buildSelectedJobContext(selected);
    }
  }

  return {
    state,
    stateChanged: true,
    jobResultsForClient,
    jobContext,
    agentStateContext: buildAgentStateContext(state) ?? undefined,
    toolStatus,
  };
}

/**
 * Runs when the latest message plausibly asks for a reminder to be set.
 * Follows the exact same shape as maybeSearchJobs above: a cheap keyword
 * gate, a small Gemini call that only EXTRACTS intent/company/date text
 * (never a timestamp), then deterministic code does the actual matching,
 * date parsing, and database mutation. Gemini never decides ownership,
 * never computes the timestamp, and never mutates anything itself — see
 * lib/notifications/intent.ts and docs/AI_AGENT.md.
 *
 * Returns a short factual note (not a message shown to the user
 * directly) appended to the system instruction, so the conversational
 * model can acknowledge what happened — or ask exactly the right
 * clarifying question — in its own voice.
 */
async function maybeCreateReminder(userText: string, applications: ApplicationWithJob[]): Promise<string | undefined> {
  if (!looksLikeReminderMessage(userText)) return undefined;

  const intent = await extractReminderIntent(userText);
  if (!intent || !intent.wantsReminder) return undefined;

  if (!intent.applicationHint) {
    return `The user wants a reminder set but didn't say which tracked application it's for. Ask them a short clarifying question (e.g. "${intent.clarifyingQuestion ?? "Which application is this for?"}") — never guess which one they mean.`;
  }

  const matched = matchApplicationByHint(intent.applicationHint, applications);
  if (!matched) {
    return `The user mentioned "${intent.applicationHint}" for a reminder, but that doesn't unambiguously match exactly one of their tracked applications (either none match or more than one does). Ask them to clarify which tracked application they mean (by exact company/role), or point them to /applications if it isn't tracked yet — never guess.`;
  }

  const company = matched.job.company_name ?? matched.job.title;

  if (!intent.normalizedDateText) {
    return `The user wants a ${intent.reminderType === "interview" ? "interview" : "follow-up"} reminder for their ${company} application but didn't give a date/time. Ask them a short clarifying question (e.g. "${intent.clarifyingQuestion ?? "What day/time works?"}").`;
  }

  const parsed = parseReminderDateTime(intent.normalizedDateText);
  if (!parsed.ok) {
    if (parsed.reason === "past") {
      return `The user asked for a reminder at a time that's already in the past ("${intent.normalizedDateText}", for their ${company} application). Tell them honestly that time has already gone by and ask for a future date instead.`;
    }
    return `The user gave a date/time ("${intent.normalizedDateText}", for their ${company} application) that couldn't be confidently understood. Ask them to restate it more simply, e.g. "next Monday" or "Friday 10am" — never guess a date.`;
  }

  const reminderKind = intent.reminderType === "interview" ? "interview" : "follow_up";
  if (reminderKind === "interview") {
    await setInterviewAt(matched.application.id, parsed.date.toISOString());
  } else {
    await setFollowUpDate(matched.application.id, parsed.date.toISOString().slice(0, 10));
  }

  return `A ${reminderKind === "interview" ? "interview" : "follow-up"} reminder was just successfully created for the user's ${company} application. Acknowledge this warmly and briefly (matching CareerLens's usual tone) — don't ask for the date again, it's already set.`;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const messages = parseMessages(body);
  if (!messages) {
    return NextResponse.json(
      {
        error:
          "Invalid request. Expected a non-empty `messages` array ending with a user message.",
      },
      { status: 400 }
    );
  }

  // /chat is a protected route (see proxy.ts), so this should always be
  // authenticated in normal usage — verified independently here rather
  // than trusting that the request could only have arrived this way.
  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;

  if (!userId) {
    return NextResponse.json({ error: "Please log in to chat with CareerLens." }, { status: 401 });
  }

  const requestedConversationId = parseConversationId(body);
  const lastUserMessageForPersist = messages[messages.length - 1];
  const conversationId = await getOrCreateConversation(
    supabase,
    userId,
    requestedConversationId,
    lastUserMessageForPersist.content
  );
  if (requestedConversationId && !conversationId) {
    // A conversationId was supplied but doesn't belong to this user — RLS
    // would reject any write anyway, but fail explicitly here rather than
    // silently starting a new conversation under a different id than the
    // client expects (Part 20: never allow one user to touch another
    // user's chats).
    return NextResponse.json({ error: "That conversation isn't available." }, { status: 403 });
  }
  if (conversationId) {
    await saveMessage(supabase, {
      conversationId,
      userId,
      role: "user",
      content: lastUserMessageForPersist.content,
    });
  }

  const [careerProfile, resumeContext, readinessSnapshot, applications] = await Promise.all([
    getCareerProfile(userId),
    buildResumeContext(userId),
    getCareerReadinessSnapshot(userId),
    getApplicationsForUser(userId),
  ]);
  const careerContext = careerProfile ? buildCareerContext(careerProfile) : undefined;
  const careerReadinessContext = buildCareerReadinessContext(readinessSnapshot) ?? undefined;

  // Status history isn't fetched here (chat only needs aggregate counts,
  // not the full per-transition timeline) — interviews-reached uses only
  // each application's CURRENT status for this compact context, which
  // slightly undercounts a rejection that came after an interview; the
  // full /applications and /analytics pages use real history for that.
  const applicationStats = computeApplicationStats(
    applications.map((a) => a.application),
    new Map<string, ApplicationStatusHistoryRow[]>()
  );
  const analyticsSummary = computeAnalyticsSummary(
    applications.map((a) => a.job),
    new Map(applications.filter((a) => a.match).map((a) => [a.job.id, a.match!]))
  );
  const applicationsContext = buildApplicationsContext(applicationStats, analyticsSummary) ?? undefined;

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const currentAgentState = conversationId ? await getAgentState(supabase, userId, conversationId) : emptyAgentState();
  const [turnOutcome, reminderContext] = await Promise.all([
    lastUserMessage
      ? runCareerAgentTurn(userId, lastUserMessage.content, currentAgentState, careerContext)
      : Promise.resolve<CareerAgentTurnOutcome>({
          state: currentAgentState,
          stateChanged: false,
          jobResultsForClient: [],
          jobContext: undefined,
          agentStateContext: undefined,
          toolStatus: null,
        }),
    lastUserMessage ? maybeCreateReminder(lastUserMessage.content, applications) : Promise.resolve(undefined),
  ]);
  const jobResults = turnOutcome.jobResultsForClient;

  if (conversationId && turnOutcome.stateChanged) {
    await saveAgentState(supabase, userId, conversationId, turnOutcome.state);
  }

  const agentStream = streamCareerAgentReply(messages, {
    signal: request.signal,
    careerContext,
    resumeContext: resumeContext ?? undefined,
    jobContext: turnOutcome.jobContext,
    careerReadinessContext,
    applicationsContext,
    reminderContext,
    agentStateContext: turnOutcome.agentStateContext,
  });

  // Resolve the first chunk before opening the HTTP stream, so an
  // immediate failure (bad/missing API key, auth error) can still return a
  // proper error status instead of a 200 response with no body.
  let firstResult: IteratorResult<string>;
  try {
    firstResult = await agentStream.next();
  } catch (error) {
    if (!isAbortError(error)) {
      console.error("[api/chat] Gemini request failed:", describeError(error));
    }
    return NextResponse.json(
      { error: "Ado 😅 Gemini eka response denna bari una.\n\nTry eka parak aye yamu." },
      { status: 502 }
    );
  }

  const encoder = new TextEncoder();

  function writeEvent(controller: ReadableStreamDefaultController<Uint8Array>, event: ChatStreamEvent) {
    controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (conversationId) {
        writeEvent(controller, { type: "conversation", conversationId });
      }
      if (turnOutcome.toolStatus) {
        writeEvent(controller, { type: "status", toolStatus: turnOutcome.toolStatus });
      }
      if (jobResults.length > 0) {
        writeEvent(controller, { type: "jobs", jobs: jobResults });
      }

      let assistantText = "";

      try {
        if (!firstResult.done) {
          assistantText += firstResult.value;
          writeEvent(controller, { type: "text", content: firstResult.value });
        }
        for await (const chunk of agentStream) {
          assistantText += chunk;
          writeEvent(controller, { type: "text", content: chunk });
        }
      } catch (error) {
        if (!isAbortError(error)) {
          console.error("[api/chat] Gemini stream interrupted:", describeError(error));
          writeEvent(controller, {
            type: "error",
            message: "Ado 😅 connection eka interrupt una.\n\nTry eka parak aye yamu.",
          });
        }
      } finally {
        if (conversationId) {
          // Persist whatever the assistant actually produced, even if the
          // stream was interrupted partway — discarding a partial reply
          // the user already saw would make a reloaded conversation lie
          // about what happened. Jobs are their own message row (mirrors
          // the client's own two-message-row rendering: a jobs card
          // message, then the text reply that follows it).
          if (jobResults.length > 0) {
            await saveMessage(supabase, {
              conversationId,
              userId,
              role: "assistant",
              content: "",
              jobResults,
            });
          }
          if (assistantText) {
            await saveMessage(supabase, {
              conversationId,
              userId,
              role: "assistant",
              content: assistantText,
            });
          }
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
