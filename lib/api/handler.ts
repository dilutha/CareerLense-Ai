import "server-only";
import { NextResponse } from "next/server";
import { apiError } from "./response";
import { logApiRequest, newRequestId } from "./log";

/**
 * Wraps a /api/v1 route handler with: a request id, safe timing/status
 * logging (Part 24), and a catch-all so an unhandled exception never
 * leaks a raw error message/stack trace to the client (Part 22) — it's
 * logged server-side (message only, via the existing `describeError`-
 * style pattern already used by /api/chat) and the client gets a generic
 * INTERNAL_ERROR instead.
 */
export function apiHandler<Ctx>(
  endpoint: string,
  handler: (request: Request, ctx: Ctx) => Promise<NextResponse>
): (request: Request, ctx: Ctx) => Promise<NextResponse> {
  return async (request: Request, ctx: Ctx) => {
    const requestId = newRequestId();
    const startedAt = Date.now();
    let response: NextResponse;

    try {
      response = await handler(request, ctx);
    } catch (error) {
      console.error(
        `[api/v1] ${requestId} unhandled error:`,
        error instanceof Error ? error.message : String(error)
      );
      response = apiError("INTERNAL_ERROR", "Something went wrong. Try again.");
    }

    logApiRequest({ requestId, endpoint, method: request.method, status: response.status, startedAt });
    response.headers.set("X-Request-Id", requestId);
    return response;
  };
}
