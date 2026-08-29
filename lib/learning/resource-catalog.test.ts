import { describe, expect, it } from "vitest";
import { findCuratedResource } from "./resource-catalog";

describe("findCuratedResource", () => {
  it("returns a real https:// resource for a known skill", () => {
    const resource = findCuratedResource("python");
    expect(resource).not.toBeNull();
    expect(resource!.url).toMatch(/^https:\/\//);
  });

  it("resolves through skill aliasing/canonicalization (case-insensitive, common aliases)", () => {
    expect(findCuratedResource("Python")).not.toBeNull();
    expect(findCuratedResource("JS")).toEqual(findCuratedResource("javascript"));
  });

  it("returns null for an unlisted skill — never fabricates a URL", () => {
    expect(findCuratedResource("SomeObscureUnlistedSkill12345")).toBeNull();
  });
});
