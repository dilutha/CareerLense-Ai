/**
 * Converts raw Supabase Auth error messages into friendly, CareerLens-toned
 * copy. Never show a raw `AuthApiError` message to the user.
 */
export function friendlyAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("already registered") || normalized.includes("already exists")) {
    return "Looks like you already have an account. Try logging in instead.";
  }
  if (normalized.includes("invalid login credentials")) {
    return "Email or password doesn't match. Give it another try.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Check your inbox — you'll need to confirm your email before logging in.";
  }
  if (normalized.includes("password") && normalized.includes("least")) {
    return "Your password needs to be a bit longer — at least 6 characters.";
  }
  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "Ado, slow down a bit 😅 Too many attempts — try again in a moment.";
  }
  if (normalized.includes("invalid email") || normalized.includes("unable to validate email")) {
    return "That email doesn't look quite right — double-check it.";
  }
  if (normalized.includes("network") || normalized.includes("fetch")) {
    return "Connection hiccup — check your internet and try again.";
  }

  return "Something went wrong on our end. Try again in a moment.";
}
