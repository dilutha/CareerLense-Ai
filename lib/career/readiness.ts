export const CAREER_READINESS_COMPONENTS = [
  "cv",
  "portfolio",
  "skills",
  "projects",
  "linkedin",
  "github",
  "interview",
  "applications",
] as const;
export type CareerReadinessComponent = (typeof CAREER_READINESS_COMPONENTS)[number];

/**
 * Must sum to 100 — see docs/PROJECT_SPEC.md's Phase 11 entry.
 * Rebalanced from Phase 10's 7-component set to add "applications"
 * (real-world application activity/response rate) as an 8th dimension,
 * per Part 5's "Application activity" — a candidate with zero
 * applications simply has this component excluded (not scored 0), same
 * as any other not-yet-analyzed dimension.
 */
export const CAREER_READINESS_WEIGHTS: Record<CareerReadinessComponent, number> = {
  cv: 18,
  portfolio: 18,
  skills: 18,
  projects: 12,
  linkedin: 8,
  github: 8,
  interview: 10,
  applications: 8,
};

/** null = "not analyzed" — deliberately distinct from 0. */
export type CareerReadinessInput = Partial<Record<CareerReadinessComponent, number | null>>;

export interface CareerReadinessResult {
  overall: number | null;
  components: Record<CareerReadinessComponent, number | null>;
  /** Components actually included in the overall calculation. */
  analyzedComponents: CareerReadinessComponent[];
  /** True when at least one component has no data yet. */
  hasUnanalyzedComponents: boolean;
}

/**
 * Weighted career-readiness score. A component with no data (null/undefined)
 * is EXCLUDED from the calculation and the remaining weights are
 * renormalized to sum to 100% — never defaulted to 0, so a candidate who
 * simply hasn't analyzed their GitHub yet isn't punished for it. Returns
 * overall: null only if literally nothing has been analyzed.
 */
export function computeCareerReadiness(input: CareerReadinessInput): CareerReadinessResult {
  const components = {} as Record<CareerReadinessComponent, number | null>;
  for (const key of CAREER_READINESS_COMPONENTS) {
    components[key] = input[key] ?? null;
  }

  const analyzedComponents = CAREER_READINESS_COMPONENTS.filter((c) => components[c] !== null);

  if (analyzedComponents.length === 0) {
    return { overall: null, components, analyzedComponents, hasUnanalyzedComponents: true };
  }

  const totalWeight = analyzedComponents.reduce((sum, c) => sum + CAREER_READINESS_WEIGHTS[c], 0);
  const weightedSum = analyzedComponents.reduce(
    (sum, c) => sum + (components[c] as number) * CAREER_READINESS_WEIGHTS[c],
    0
  );

  return {
    overall: Math.round(weightedSum / totalWeight),
    components,
    analyzedComponents,
    hasUnanalyzedComponents: analyzedComponents.length < CAREER_READINESS_COMPONENTS.length,
  };
}
