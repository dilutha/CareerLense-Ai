import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { LearningRoadmapItemRow, LearningRoadmapRow, LearningRoadmapWithItems } from "./types";

export async function getLearningRoadmap(userId: string, targetRole: string): Promise<LearningRoadmapWithItems | null> {
  const supabase = await createServerSupabaseClient();

  const { data: roadmap } = await supabase
    .from("learning_roadmaps")
    .select("*")
    .eq("profile_id", userId)
    .eq("target_role", targetRole)
    .maybeSingle();

  if (!roadmap) return null;
  const roadmapRow = roadmap as LearningRoadmapRow;

  const { data: items } = await supabase
    .from("learning_roadmap_items")
    .select("*")
    .eq("roadmap_id", roadmapRow.id)
    .eq("profile_id", userId)
    .order("step_order", { ascending: true });

  return { roadmap: roadmapRow, items: (items ?? []) as LearningRoadmapItemRow[] };
}

export async function getAllLearningRoadmaps(userId: string): Promise<LearningRoadmapRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("learning_roadmaps")
    .select("*")
    .eq("profile_id", userId)
    .order("updated_at", { ascending: false });
  return (data ?? []) as LearningRoadmapRow[];
}
