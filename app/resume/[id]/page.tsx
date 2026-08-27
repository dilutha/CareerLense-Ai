import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ResumeAnalysis } from "@/components/resume/ResumeAnalysis";
import { requireUser } from "@/lib/auth/require-user";
import { getResumeById } from "@/lib/resume/get-resumes";

export default async function ResumeDetailPage(props: PageProps<"/resume/[id]">) {
  const { id } = await props.params;
  const user = await requireUser(`/resume/${id}`);
  const result = await getResumeById(user.id, id);

  if (!result) {
    notFound();
  }

  return (
    <main className="min-h-dvh bg-sea-gradient-soft px-6 py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <Link
          href="/profile"
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-navy-light/70 hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to profile
        </Link>

        <ResumeAnalysis resumeWithAnalysis={result} />
      </div>
    </main>
  );
}
