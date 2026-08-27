import { ProfileSetupWizard } from "@/components/profile/ProfileSetupWizard";
import { requireUser } from "@/lib/auth/require-user";
import { getCareerProfile } from "@/lib/career-profile/get-profile";

export default async function ProfileSetupPage() {
  const user = await requireUser("/profile/setup");
  const existing = await getCareerProfile(user.id);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-sea-gradient-soft px-6 py-16">
      <ProfileSetupWizard initialName={existing?.profile.full_name ?? ""} />
    </main>
  );
}
