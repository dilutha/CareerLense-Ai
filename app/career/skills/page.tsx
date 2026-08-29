import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SkillGapDashboard } from "@/components/career/SkillGapDashboard";
import { requireUser } from "@/lib/auth/require-user";
import { getCareerProfile } from "@/lib/career-profile/get-profile";
import { classifyMarketSkills, computeMarketSkillDemand } from "@/lib/career/market-skills";
import { prioritizeSkillGaps } from "@/lib/career/skill-gap-priority";
import { getDefaultResume } from "@/lib/resume/get-resumes";

export default async function SkillGapPage() {
  const user = await requireUser("/career/skills");

  const [profile, resume] = await Promise.all([getCareerProfile(user.id), getDefaultResume(user.id)]);
  const targetRole = profile?.careerPreferences?.target_role ?? null;
  const profileSkills = profile?.skills.map((s) => s.skill.name) ?? [];
  const resumeSkills = resume?.analysis?.skills.map((s) => s.name) ?? [];
  const candidateSkills = [...new Set([...profileSkills, ...resumeSkills])];

  const marketReport = targetRole ? await computeMarketSkillDemand(targetRole) : null;
  const classified = marketReport ? classifyMarketSkills(marketReport, candidateSkills) : [];
  const prioritized = prioritizeSkillGaps(classified);

  return (
    <main className="min-h-dvh bg-sea-gradient-soft px-6 py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Link
          href="/career"
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-navy-light/70 hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to career dashboard
        </Link>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-navy sm:text-3xl">Skill Gaps</h1>
          <p className="text-sm text-navy-light/70">
            Based on real skill demand across the jobs CareerLens has actually found for your target role.
          </p>
        </div>

        <SkillGapDashboard
          targetRole={targetRole}
          marketReport={marketReport}
          classified={classified}
          prioritized={prioritized}
        />
      </div>
    </main>
  );
}
