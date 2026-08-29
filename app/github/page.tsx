import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GitHubDashboard } from "@/components/github/GitHubDashboard";
import { requireUser } from "@/lib/auth/require-user";
import { getLatestGitHubAnalysis } from "@/lib/github/get-github";

export default async function GitHubPage() {
  const user = await requireUser("/github");
  const analysis = await getLatestGitHubAnalysis(user.id);

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
          <h1 className="text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
            GitHub Intelligence
          </h1>
          <p className="text-sm text-navy-light/70">
            Public profile + repositories, checked against your target role.
          </p>
        </div>

        <GitHubDashboard analysis={analysis} />
      </div>
    </main>
  );
}
