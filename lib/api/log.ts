import "server-only";

/**
 * Safe request logging for /api/v1 (Part 24) — request id, endpoint,
 * method, status, latency ONLY. Never call this with anything beyond
 * these fields: no resume text, cover letter content, CV content, email,
 * phone, tokens, or API keys ever pass through this function's
 * parameters, so there's no way to accidentally log them here.
 */
export function logApiRequest(input: {
  requestId: string;
  endpoint: string;
  method: string;
  status: number;
  startedAt: number;
}): void {
  const latencyMs = Date.now() - input.startedAt;
  console.log(
    `[api/v1] ${input.requestId} ${input.method} ${input.endpoint} -> ${input.status} (${latencyMs}ms)`
  );
}

export function newRequestId(): string {
  return crypto.randomUUID();
}
