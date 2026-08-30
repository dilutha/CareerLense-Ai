import { BackLink } from "@/components/ui/BackLink";
import { RoadmapDashboard } from "@/components/career/RoadmapDashboard";
import { requireUser } from "@/lib/auth/require-user";
import { getCareerProfile } from "@/lib/career-profile/get-profile";
import { getLearningRoadmap } from "@/lib/learning/get-roadmap";

export default async function RoadmapPage() {
  const user = await requireUser("/career/roadmap");
  const profile = await getCareerProfile(user.id);
  const targetRole = profile?.careerPreferences?.target_role ?? null;

  const roadmap = targetRole ? await getLearningRoadmap(user.id, targetRole) : null;

  return (
    <main className="min-h-dvh bg-sea-gradient-soft px-6 py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <BackLink href="/career" label="Back to career dashboard" />

        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-navy sm:text-3xl">Learning Roadmap</h1>
          <p className="text-sm text-navy-light/70">
            A personalized, data-backed plan — durations are estimates, not promises.
          </p>
        </div>

        <RoadmapDashboard targetRole={targetRole} roadmap={roadmap} />
      </div>
    </main>
  );
}
