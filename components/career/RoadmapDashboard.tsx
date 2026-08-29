"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink, Loader2, RefreshCw, Timer } from "lucide-react";
import { generateLearningRoadmap, updateLearningItemStatus } from "@/lib/learning/actions";
import type { LearningItemStatus } from "@/lib/learning/schemas";
import type { LearningRoadmapWithItems } from "@/lib/learning/types";

const STATUS_ICONS: Record<LearningItemStatus, typeof Circle> = {
  not_started: Circle,
  in_progress: Timer,
  completed: CheckCircle2,
};

export function RoadmapDashboard({
  targetRole,
  roadmap,
}: {
  targetRole: string | null;
  roadmap: LearningRoadmapWithItems | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleGenerate() {
    if (!targetRole) return;
    startTransition(async () => {
      await generateLearningRoadmap(targetRole);
      router.refresh();
    });
  }

  function handleStatusChange(itemId: string, status: LearningItemStatus) {
    startTransition(async () => {
      await updateLearningItemStatus(itemId, status);
      router.refresh();
    });
  }

  if (!targetRole) {
    return (
      <div className="rounded-2xl border border-navy/10 bg-white p-6 text-center text-sm text-navy-light/70">
        Set a target role in{" "}
        <Link href="/profile" className="font-medium text-ocean hover:text-navy">
          your profile
        </Link>{" "}
        first.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={pending}
        className="flex w-fit items-center gap-2 rounded-full bg-sea-gradient px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-ocean/20 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
        {roadmap ? "Refresh roadmap" : "Generate my roadmap"}
      </button>

      {!roadmap && !pending && (
        <div className="rounded-2xl border border-navy/10 bg-white p-6 text-center text-sm text-navy-light/70">
          No roadmap yet for {targetRole} — generate one from your real skill gaps.
        </div>
      )}

      {roadmap && (
        <>
          {roadmap.roadmap.summary && (
            <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
              <p className="text-sm text-navy-light/80">{roadmap.roadmap.summary}</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {roadmap.items.map((item, i) => {
              const Icon = STATUS_ICONS[item.status];
              return (
                <div key={item.id} className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <Icon
                      className={`mt-0.5 h-5 w-5 shrink-0 ${item.status === "completed" ? "text-emerald-600" : "text-navy-light/40"}`}
                      aria-hidden="true"
                    />
                    <div className="flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-navy-light/40">
                        Step {i + 1}
                      </p>
                      <p className="text-sm font-semibold text-navy">{item.title}</p>
                      <p className="text-xs text-navy-light/60">{item.estimated_duration_text}</p>
                      {item.resource_url ? (
                        <a
                          href={item.resource_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 flex w-fit items-center gap-1 text-xs font-medium text-ocean hover:text-navy"
                        >
                          {item.resource_note ?? "Open resource"}
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : (
                        item.resource_note && <p className="mt-1 text-xs text-navy-light/50">{item.resource_note}</p>
                      )}
                      <select
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.id, e.target.value as LearningItemStatus)}
                        disabled={pending}
                        className="mt-2 rounded-lg border border-navy/10 bg-foam px-2 py-1 text-xs font-medium text-navy disabled:opacity-50"
                      >
                        <option value="not_started">Not started</option>
                        <option value="in_progress">In progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
