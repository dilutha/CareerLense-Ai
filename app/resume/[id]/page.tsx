import { notFound } from "next/navigation";
import { BackLink } from "@/components/ui/BackLink";
import { ResumeAnalysis } from "@/components/resume/ResumeAnalysis";
import { requireUser } from "@/lib/auth/require-user";
import { getResumeViaWso2OrDirect } from "@/lib/resume/get-resume-via-wso2";

export default async function ResumeDetailPage(props: PageProps<"/resume/[id]">) {
  const { id } = await props.params;
  const user = await requireUser(`/resume/${id}`);
  const result = await getResumeViaWso2OrDirect(user.id, id);

  if (!result) {
    notFound();
  }

  return (
    <main className="min-h-dvh bg-sea-gradient-soft px-6 py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <BackLink href="/profile" label="Back to profile" />

        <ResumeAnalysis resumeWithAnalysis={result} />
      </div>
    </main>
  );
}
