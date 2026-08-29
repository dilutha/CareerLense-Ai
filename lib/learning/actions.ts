"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { getOptionalUser } from "@/lib/auth/require-user";
import { getCareerProfile } from "@/lib/career-profile/get-profile";
import { classifyMarketSkills, computeMarketSkillDemand } from "@/lib/career/market-skills";
import { prioritizeSkillGaps } from "@/lib/career/skill-gap-priority";
import { getDefaultResume } from "@/lib/resume/get-resumes";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildRoadmapPlan } from "./build-plan";
import { narrateRoadmap } from "./generate-roadmap";
import type { LearningItemStatus } from "./schemas";

export interface ActionResult {
  success: boolean;
  error?: string;
}

function computeContentHash(targetRole: string, skills: string[]): string {
  return crypto.createHash("sha256").update(`${targetRole}|${[...skills].sort().join(",")}`).digest("hex");
}

/** Generates (or, if inputs are unchanged, reuses) a learning roadmap for the given target role. */
export async function generateLearningRoadmap(targetRole: string): Promise<ActionResult & { roadmapId?: string }> {
  const user = await getOptionalUser();
  if (!user) return { success: false, error: "Please log in again." };

  const trimmedRole = targetRole.trim();
  if (!trimmedRole) return { success: false, error: "Tell me what role you're targeting first." };

  const [profile, resume] = await Promise.all([getCareerProfile(user.id), getDefaultResume(user.id)]);
  const profileSkills = profile?.skills.map((s) => s.skill.name) ?? [];
  const resumeSkills = resume?.analysis?.skills.map((s) => s.name) ?? [];
  const candidateSkills = [...new Set([...profileSkills, ...resumeSkills])];

  const contentHash = computeContentHash(trimmedRole, candidateSkills);
  const supabase = await createServerSupabaseClient();

  const { data: existing } = await supabase
    .from("learning_roadmaps")
    .select("id, content_hash")
    .eq("profile_id", user.id)
    .eq("target_role", trimmedRole)
    .maybeSingle();

  if (existing && (existing as { content_hash: string }).content_hash === contentHash) {
    return { success: true, roadmapId: (existing as { id: string }).id };
  }

  const marketReport = await computeMarketSkillDemand(trimmedRole);
  const classified = classifyMarketSkills(marketReport, candidateSkills);
  const prioritized = prioritizeSkillGaps(classified);
  // No separate "experience level" field exists on career_preferences —
  // omitted rather than guessed (buildRoadmapPlan handles null gracefully).
  const steps = buildRoadmapPlan(prioritized, trimmedRole, null);

  if (steps.length === 0) {
    return {
      success: false,
      error: marketReport.relevantJobCount === 0
        ? "I don't have enough matched jobs for this role yet to build a data-backed roadmap — search for some jobs first."
        : "Couldn't identify any skill gaps to build a roadmap from — your profile already covers what's showing up in matched jobs!",
    };
  }

  const summary = await narrateRoadmap(steps, trimmedRole);

  const roadmapId = (existing as { id: string } | null)?.id;
  let finalRoadmapId: string;

  if (roadmapId) {
    const { error } = await supabase
      .from("learning_roadmaps")
      .update({ content_hash: contentHash, summary, generated_at: new Date().toISOString() })
      .eq("id", roadmapId)
      .eq("profile_id", user.id);
    if (error) {
      console.error("[learning] Updating roadmap failed:", error.message);
      return { success: false, error: "Couldn't save the roadmap. Try again." };
    }
    await supabase.from("learning_roadmap_items").delete().eq("roadmap_id", roadmapId).eq("profile_id", user.id);
    finalRoadmapId = roadmapId;
  } else {
    const { data: inserted, error } = await supabase
      .from("learning_roadmaps")
      .insert({ profile_id: user.id, target_role: trimmedRole, content_hash: contentHash, summary })
      .select("id")
      .single();
    if (error || !inserted) {
      console.error("[learning] Creating roadmap failed:", error?.message);
      return { success: false, error: "Couldn't save the roadmap. Try again." };
    }
    finalRoadmapId = (inserted as { id: string }).id;
  }

  const itemRows = steps.map((step) => ({
    roadmap_id: finalRoadmapId,
    profile_id: user.id,
    step_order: step.stepOrder,
    title: step.title,
    skill: step.skill,
    resource_type: step.resourceType,
    resource_url: step.resourceUrl,
    resource_note: step.resourceNote,
    estimated_duration_text: step.estimatedDurationText,
  }));

  const { error: itemsError } = await supabase.from("learning_roadmap_items").insert(itemRows);
  if (itemsError) {
    console.error("[learning] Saving roadmap items failed:", itemsError.message);
    return { success: false, error: "Saved the roadmap but couldn't save its steps. Try again." };
  }

  revalidatePath("/career/roadmap");
  return { success: true, roadmapId: finalRoadmapId };
}

export async function updateLearningItemStatus(itemId: string, status: LearningItemStatus): Promise<ActionResult> {
  const user = await getOptionalUser();
  if (!user) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();
  const update: Record<string, unknown> = { status };
  if (status === "in_progress") update.started_at = new Date().toISOString();
  if (status === "completed") update.completed_at = new Date().toISOString();

  const { error } = await supabase
    .from("learning_roadmap_items")
    .update(update)
    .eq("id", itemId)
    .eq("profile_id", user.id);

  if (error) return { success: false, error: "Couldn't update that item." };

  revalidatePath("/career/roadmap");
  return { success: true };
}
