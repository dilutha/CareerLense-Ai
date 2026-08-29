import { NextResponse } from "next/server";

/**
 * Consistent envelope for every /api/v1 response (WSO2 integration —
 * PROJECT_SPEC's own required shape). Kept separate from the existing
 * NDJSON /api/chat protocol on purpose — these are stable, non-streaming
 * JSON responses meant to sit behind an API gateway, not a chat stream.
 */
export const API_ERROR_CODES = [
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export function apiSuccess<T extends Record<string, unknown>>(body: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, ...body }, { status });
}

/**
 * Never pass a raw caught `error` object's message straight through for
 * INTERNAL_ERROR — that's exactly the "leak database errors/stack
 * traces" failure mode Part 22 forbids. Callers pass a short, safe,
 * hand-written message; the real error is logged server-side separately
 * (see log.ts) via its own call, never returned to the client.
 */
export function apiError(code: ApiErrorCode, message: string): NextResponse {
  return NextResponse.json({ success: false, error: { code, message } }, { status: STATUS_BY_CODE[code] });
}
