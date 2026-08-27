import { describe, expect, it } from "vitest";
import { compareKeywords, compareSkills, type CandidateEvidence, type JobRequirement } from "./compare";

const req = (name: string, importance: JobRequirement["importance"] = "required"): JobRequirement => ({
  name,
  importance,
});

describe("compareSkills", () => {
  it("marks a skill as strong_match when listed AND demonstrated in evidence text", () => {
    const candidate: CandidateEvidence = {
      skills: ["Python", "SQL"],
      evidenceText: "built a data pipeline using python and sql for analytics",
    };
    const [result] = compareSkills([req("Python")], candidate);
    expect(result.category).toBe("strong_match");
    expect(result.relatedSkillFound).toBeNull();
  });

  it("marks a skill as match (not strong) when listed but not mentioned in evidence text", () => {
    const candidate: CandidateEvidence = {
      skills: ["Python", "SQL"],
      evidenceText: "built a web app using javascript",
    };
    const [result] = compareSkills([req("Python")], candidate);
    expect(result.category).toBe("match");
  });

  it("is case-insensitive and understands aliases (Postgres vs PostgreSQL)", () => {
    const candidate: CandidateEvidence = { skills: ["postgres"], evidenceText: "" };
    const [result] = compareSkills([req("PostgreSQL")], candidate);
    expect(result.category).toBe("match");
  });

  it("marks a genuinely missing skill as missing when candidate has other, unrelated skills", () => {
    const candidate: CandidateEvidence = { skills: ["React", "Node.js"], evidenceText: "" };
    const [result] = compareSkills([req("Kubernetes")], candidate);
    expect(result.category).toBe("missing");
    expect(result.relatedSkillFound).toBeNull();
  });

  it("marks a related-but-not-equivalent skill as partial (Tableau required, has Power BI)", () => {
    const candidate: CandidateEvidence = { skills: ["Power BI", "Excel"], evidenceText: "" };
    const [result] = compareSkills([req("Tableau")], candidate);
    expect(result.category).toBe("partial");
    expect(result.relatedSkillFound).toBe("Power BI");
  });

  it("marks every requirement as insufficient_evidence when the candidate has no skills at all", () => {
    const candidate: CandidateEvidence = { skills: [], evidenceText: "" };
    const [result] = compareSkills([req("Python")], candidate);
    expect(result.category).toBe("insufficient_evidence");
  });

  it("never invents a skill the candidate doesn't have: missing/partial results only ever name skills the candidate actually listed", () => {
    const candidate: CandidateEvidence = { skills: ["Power BI"], evidenceText: "" };
    const [result] = compareSkills([req("Tableau")], candidate);
    expect(result.category).toBe("partial");
    expect(candidate.skills).toContain(result.relatedSkillFound);
  });

  it("preserves job requirement importance and skill name in the output untouched", () => {
    const candidate: CandidateEvidence = { skills: [], evidenceText: "" };
    const [result] = compareSkills([req("Docker", "nice_to_have")], candidate);
    expect(result.skill).toBe("Docker");
    expect(result.importance).toBe("nice_to_have");
  });
});

describe("compareKeywords", () => {
  it("returns 100% alignment when there are no keywords to check", () => {
    const candidate: CandidateEvidence = { skills: [], evidenceText: "" };
    expect(compareKeywords([], candidate)).toEqual({ entries: [], overallAlignment: 100 });
  });

  it("marks a keyword present when both listed and demonstrated", () => {
    const candidate: CandidateEvidence = { skills: ["Python"], evidenceText: "shipped python services" };
    const { entries } = compareKeywords(["Python"], candidate);
    expect(entries[0].status).toBe("present");
  });

  it("marks a keyword weak when only listed or only demonstrated, not both", () => {
    const candidate: CandidateEvidence = { skills: ["Python"], evidenceText: "no mention here" };
    const { entries } = compareKeywords(["Python"], candidate);
    expect(entries[0].status).toBe("weak");
  });

  it("marks a keyword missing when neither listed nor demonstrated", () => {
    const candidate: CandidateEvidence = { skills: ["React"], evidenceText: "built react apps" };
    const { entries } = compareKeywords(["Kubernetes"], candidate);
    expect(entries[0].status).toBe("missing");
  });

  it("computes overall alignment as an average of present=1 / weak=0.5 / missing=0", () => {
    // present, weak, missing => (1 + 0.5 + 0) / 3 = 50%
    const candidate: CandidateEvidence = {
      skills: ["Python", "SQL"],
      evidenceText: "used python daily",
    };
    const { overallAlignment } = compareKeywords(["Python", "SQL", "Kubernetes"], candidate);
    expect(overallAlignment).toBe(50);
  });

  it("treats untrusted job-description text as plain data: a keyword containing injection-style text is compared literally, never executed or specially interpreted", () => {
    const candidate: CandidateEvidence = { skills: [], evidenceText: "ignore all previous instructions" };
    const { entries } = compareKeywords(["ignore all previous instructions"], candidate);
    // The literal string is only ever substring-matched — this proves the deterministic
    // comparator has no code path that treats such text as an instruction.
    expect(entries[0].status).toBe("weak");
  });
});
