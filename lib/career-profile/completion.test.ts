import { describe, expect, it } from "vitest";
import { calculateProfileCompletion } from "./completion";
import type { CareerProfile } from "./types";

function emptyProfile(): CareerProfile {
  return {
    profile: {
      id: "u1",
      full_name: null,
      headline: null,
      bio: null,
      location: null,
      phone: null,
      linkedin_url: null,
      github_url: null,
      portfolio_url: null,
      created_at: "",
      updated_at: "",
    },
    skills: [],
    education: [],
    experience: [],
    projects: [],
    careerPreferences: null,
  };
}

describe("calculateProfileCompletion", () => {
  it("is 0% with no items done for a completely empty profile — never crashes on nulls", () => {
    const result = calculateProfileCompletion(emptyProfile());
    expect(result.percent).toBe(0);
    expect(result.items.every((i) => !i.done)).toBe(true);
  });

  it("is 100% when every field is filled", () => {
    const profile = emptyProfile();
    profile.profile.full_name = "Nimal";
    profile.profile.location = "Colombo";
    profile.profile.portfolio_url = "https://example.com";
    profile.education = [{ id: "e1" } as CareerProfile["education"][number]];
    profile.skills = [
      { skill: { id: "s1", name: "SQL" }, proficiency: "intermediate" },
      { skill: { id: "s2", name: "Python" }, proficiency: "intermediate" },
      { skill: { id: "s3", name: "Power BI" }, proficiency: "intermediate" },
    ] as CareerProfile["skills"];
    profile.projects = [{ id: "p1" } as CareerProfile["projects"][number]];
    profile.careerPreferences = {
      target_role: "Data Analyst",
      preferred_locations: [],
    } as unknown as CareerProfile["careerPreferences"];

    const result = calculateProfileCompletion(profile);
    expect(result.percent).toBe(100);
    expect(result.items.every((i) => i.done)).toBe(true);
  });

  it("counts skills only once 3+ are present, not for 1-2", () => {
    const profile = emptyProfile();
    profile.skills = [{ skill: { id: "s1", name: "SQL" }, proficiency: "intermediate" }] as CareerProfile["skills"];
    const result = calculateProfileCompletion(profile);
    const skillsItem = result.items.find((i) => i.label === "Skills");
    expect(skillsItem?.done).toBe(false);
  });

  it("accepts a location from either profile.location or career preferences", () => {
    const profile = emptyProfile();
    profile.careerPreferences = {
      target_role: null,
      preferred_locations: ["Colombo"],
    } as unknown as CareerProfile["careerPreferences"];
    const result = calculateProfileCompletion(profile);
    const locationItem = result.items.find((i) => i.label === "Preferred location");
    expect(locationItem?.done).toBe(true);
  });

  it("never blocks on profile completion being partial — always returns a usable result", () => {
    const profile = emptyProfile();
    profile.profile.full_name = "Nimal";
    const result = calculateProfileCompletion(profile);
    expect(result.percent).toBeGreaterThan(0);
    expect(result.percent).toBeLessThan(100);
  });
});
