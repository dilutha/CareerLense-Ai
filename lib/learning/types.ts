import type { LearningItemStatus, ResourceType } from "./schemas";

export interface LearningRoadmapRow {
  id: string;
  profile_id: string;
  target_role: string;
  content_hash: string;
  summary: string | null;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

export interface LearningRoadmapItemRow {
  id: string;
  roadmap_id: string;
  profile_id: string;
  step_order: number;
  title: string;
  skill: string;
  resource_type: ResourceType;
  resource_url: string | null;
  resource_note: string | null;
  estimated_duration_text: string | null;
  status: LearningItemStatus;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface LearningRoadmapWithItems {
  roadmap: LearningRoadmapRow;
  items: LearningRoadmapItemRow[];
}
