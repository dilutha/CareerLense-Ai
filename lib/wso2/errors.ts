/**
 * Typed error categories for every external call this app makes through
 * WSO2 — lets callers (and the UI) react to "the gateway rejected us"
 * differently from "the upstream is slow" differently from "our own
 * config is wrong", without parsing message strings.
 */
export type WSO2ErrorCategory =
  | "CONFIG_ERROR" // WSO2_API_BASE_URL/WSO2_API_KEY missing — our own setup, not WSO2's fault
  | "AUTH_ERROR" // WSO2 rejected the API key/subscription (401/403)
  | "UPSTREAM_UNAUTHORIZED" // WSO2 accepted us, but the forwarded user bearer token was rejected by /api/v1 itself
  | "RATE_LIMIT_ERROR" // WSO2 throttling (429)
  | "TIMEOUT_ERROR" // request exceeded the configured timeout
  | "UPSTREAM_ERROR" // WSO2 or the backend it proxies to returned 5xx
  | "NETWORK_ERROR" // fetch itself failed (DNS, connection refused, etc.)
  | "VALIDATION_ERROR"; // WSO2/backend responded 200 but with an unexpected shape

export class WSO2Error extends Error {
  readonly category: WSO2ErrorCategory;
  readonly status: number | null;
  readonly correlationId: string;

  constructor(category: WSO2ErrorCategory, message: string, correlationId: string, status: number | null = null) {
    super(message);
    this.name = "WSO2Error";
    this.category = category;
    this.status = status;
    this.correlationId = correlationId;
  }
}

/** A short, user-safe message per category — never the raw upstream error text. */
export function friendlyWso2Message(category: WSO2ErrorCategory): string {
  switch (category) {
    case "CONFIG_ERROR":
      return "The WSO2 API integration isn't configured yet.";
    case "AUTH_ERROR":
      return "Couldn't authenticate with the API gateway.";
    case "UPSTREAM_UNAUTHORIZED":
      return "Please log in again.";
    case "RATE_LIMIT_ERROR":
      return "Too many requests right now — please try again shortly.";
    case "TIMEOUT_ERROR":
      return "The request took too long. Please try again.";
    case "UPSTREAM_ERROR":
      return "Something went wrong on the server. Please try again.";
    case "NETWORK_ERROR":
      return "Couldn't reach the API gateway. Please try again.";
    case "VALIDATION_ERROR":
      return "Received an unexpected response. Please try again.";
  }
}
