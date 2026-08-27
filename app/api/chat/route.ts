import { NextResponse } from "next/server";
import { streamCareerAgentReply } from "@/lib/ai/career-agent";
import { MAX_HISTORY_MESSAGES, MAX_MESSAGE_LENGTH } from "@/lib/ai/config";
import type { AgentMessage, ChatRole, ChatStreamEvent } from "@/lib/ai/types";
import { getCareerProfile } from "@/lib/career-profile/get-profile";
import { buildCareerContext } from "@/lib/career-profile/profile-context";
import { searchJobsForCurrentUser } from "@/lib/jobs/actions";
import { extractJobSearchIntent, looksLikeJobSearchMessage } from "@/lib/jobs/intent";
import { buildJobResultsContext, toJobResultSummary, type JobResultSummary } from "@/lib/jobs/summary";
import { buildResumeContext } from "@/lib/resume/get-resume-context";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const VALID_ROLES: ChatRole[] = ["user", "assistant", "system"];
const MAX_JOB_RESULTS_IN_CHAT = 5;

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

/**
 * Runs job search when the latest message plausibly asks for it. Never
 * throws — a failed/unavailable search just means no job results this
 * turn, the conversational reply still proceeds normally.
 */
async function maybeSearchJobs(
  userText: string,
  careerContext: string | undefined
): Promise<JobResultSummary[]> {
  if (!looksLikeJobSearchMessage(userText)) return [];

  const intent = await extractJobSearchIntent(userText, careerContext ?? null);
  if (!intent || !intent.shouldSearch) return [];

  const response = await searchJobsForCurrentUser({
    role: intent.role,
    location: intent.location,
    country: intent.country,
    level: intent.level,
    workMode: intent.workMode,
    keywords: intent.keywords,
    limit: 20,
  });

  if ("error" in response) return [];

  const isDemo = response.providerStatus.some((p) => p.isDemo);
  return response.results
    .slice(0, MAX_JOB_RESULTS_IN_CHAT)
    .map((r) => toJobResultSummary(r, isDemo));
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

  const [careerProfile, resumeContext] = await Promise.all([
    getCareerProfile(userId),
    buildResumeContext(userId),
  ]);
  const careerContext = careerProfile ? buildCareerContext(careerProfile) : undefined;

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const jobResults = lastUserMessage
    ? await maybeSearchJobs(lastUserMessage.content, careerContext)
    : [];
  const jobContext = buildJobResultsContext(jobResults) ?? undefined;

  const agentStream = streamCareerAgentReply(messages, {
    signal: request.signal,
    careerContext,
    resumeContext: resumeContext ?? undefined,
    jobContext,
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
      if (jobResults.length > 0) {
        writeEvent(controller, { type: "jobs", jobs: jobResults });
      }

      try {
        if (!firstResult.done) {
          writeEvent(controller, { type: "text", content: firstResult.value });
        }
        for await (const chunk of agentStream) {
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
