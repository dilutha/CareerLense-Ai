import Link from "next/link";
import { BackLink } from "@/components/ui/BackLink";
import { CareerPreferencesForm } from "@/components/profile/CareerPreferencesForm";
import { CompletionCard } from "@/components/profile/CompletionCard";
import { EducationSection } from "@/components/profile/EducationSection";
import { ExperienceSection } from "@/components/profile/ExperienceSection";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProjectsSection } from "@/components/profile/ProjectsSection";
import { SkillsSection } from "@/components/profile/SkillsSection";
import { ResumeList } from "@/components/resume/ResumeList";
import { requireUser } from "@/lib/auth/require-user";
import { calculateProfileCompletion } from "@/lib/career-profile/completion";
import { getCareerProfileViaWso2OrDirect } from "@/lib/career-profile/get-profile-via-wso2";
import { getResumesForUser } from "@/lib/resume/get-resumes";

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const [careerProfile, resumes] = await Promise.all([
    getCareerProfileViaWso2OrDirect(user.id),
    getResumesForUser(user.id),
  ]);

  if (!careerProfile) {
    // Should not normally happen — the signup trigger creates a profile
    // row for every new user — but recover gracefully rather than crash.
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-sea-gradient-soft px-6 text-center">
        <p className="text-navy">We couldn&apos;t find your profile yet.</p>
        <Link href="/profile/setup" className="font-medium text-ocean hover:text-navy">
          Set up your profile →
        </Link>
      </main>
    );
  }

  const completion = calculateProfileCompletion(careerProfile);

  return (
    <main className="min-h-dvh bg-sea-gradient-soft px-6 py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <BackLink toChat />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
          Career Profile
        </h1>

        <ProfileHeader profile={careerProfile.profile} />
        <CompletionCard completion={completion} />
        <ResumeList resumes={resumes} />
        <CareerPreferencesForm preferences={careerProfile.careerPreferences} />
        <SkillsSection skills={careerProfile.skills} />
        <EducationSection education={careerProfile.education} />
        <ExperienceSection experience={careerProfile.experience} />
        <ProjectsSection projects={careerProfile.projects} />
      </div>
    </main>
  );
}
