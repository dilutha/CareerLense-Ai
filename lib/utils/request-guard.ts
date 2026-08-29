/**
 * Guards against out-of-order async responses clobbering newer UI state —
 * the root cause of the "Can't enter your preference" bug: two
 * consecutive `updateCareerPreferences` calls (e.g. Data Analyst, then
 * Business Analyst) race over the network, and if the OLDER call's
 * response happens to arrive after the newer one's, its
 * success/error/`setSaved` state overwrites the correct, more recent
 * result — even though the actual database write already succeeded.
 * HTTP 200 + a correct server log doesn't mean the CLIENT applied the
 * right result: this only exists because `useTransition`'s `pending`
 * flag alone doesn't prevent overlapping requests (a second submission
 * can start before the first's promise resolves).
 *
 * Usage: call `start()` right before firing a request to get a token;
 * only apply that request's result if `isCurrent(token)` is still true
 * when it resolves. A newer `start()` call invalidates every earlier
 * token, so a stale response is silently dropped instead of overwriting
 * fresher state — never a timeout guess, never hiding a genuine error.
 */
export interface RequestGuard {
  start(): number;
  isCurrent(token: number): boolean;
}

export function createRequestGuard(): RequestGuard {
  let latest = 0;
  return {
    start() {
      latest += 1;
      return latest;
    },
    isCurrent(token: number) {
      return token === latest;
    },
  };
}
