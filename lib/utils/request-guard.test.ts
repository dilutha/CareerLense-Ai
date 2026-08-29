import { describe, expect, it } from "vitest";
import { createRequestGuard } from "./request-guard";

describe("createRequestGuard", () => {
  it("the first token is current when it's the only one started", () => {
    const guard = createRequestGuard();
    const token = guard.start();
    expect(guard.isCurrent(token)).toBe(true);
  });

  it("an older token is no longer current once a newer one has started", () => {
    const guard = createRequestGuard();
    const first = guard.start();
    const second = guard.start();
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
  });

  it("reproduces the exact race: an older (slower) request resolving AFTER a newer (faster) one is correctly identified as stale", () => {
    const guard = createRequestGuard();
    // User saves "Data Analyst" — request A starts.
    const tokenA = guard.start();
    // Before A resolves, user changes their mind and saves "Business Analyst" — request B starts.
    const tokenB = guard.start();
    // B's response (the correct, latest one) arrives first.
    expect(guard.isCurrent(tokenB)).toBe(true);
    // A's response (stale — an earlier click) arrives after B already landed.
    expect(guard.isCurrent(tokenA)).toBe(false);
  });

  it("each guard instance tracks its own sequence independently", () => {
    const guardOne = createRequestGuard();
    const guardTwo = createRequestGuard();
    const tokenOne = guardOne.start();
    guardTwo.start();
    expect(guardOne.isCurrent(tokenOne)).toBe(true);
  });
});
