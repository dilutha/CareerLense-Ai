export const LEARNING_ITEM_STATUSES = ["not_started", "in_progress", "completed"] as const;
export type LearningItemStatus = (typeof LEARNING_ITEM_STATUSES)[number];

export const RESOURCE_TYPES = ["course", "documentation", "tutorial", "practice", "project", "certification"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export interface RoadmapStepPlan {
  stepOrder: number;
  title: string;
  skill: string;
  resourceType: ResourceType;
  resourceUrl: string | null;
  resourceNote: string | null;
  estimatedDurationText: string;
}
