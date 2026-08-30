import { BackLink } from "@/components/ui/BackLink";
import { StartInterviewForm } from "@/components/interview/StartInterviewForm";
import { SessionHistoryList } from "@/components/interview/SessionHistoryList";
import { requireUser } from "@/lib/auth/require-user";
import { getSavedJobsForUser } from "@/lib/jobs/get-jobs";
import { getInterviewSessionsForUser } from "@/lib/interview/get-interview";

export default async function InterviewPage() {
  const user = await requireUser("/interview");

  const [savedJobs, sessions] = await Promise.all([
    getSavedJobsForUser(user.id),
    getInterviewSessionsForUser(user.id),
  ]);

  return (
    <main className="min-h-dvh bg-sea-gradient-soft px-6 py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <BackLink href="/career" label="Back to career dashboard" />

        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
            Interview Coach
          </h1>
          <p className="text-sm text-navy-light/70">
            Job-specific or general practice, grounded in your actual profile and CV.
          </p>
        </div>

        <StartInterviewForm
          savedJobs={savedJobs.map((s) => ({
            id: s.job.id,
            title: s.job.title,
            company: s.job.company_name,
          }))}
        />

        <SessionHistoryList sessions={sessions} />
      </div>
    </main>
  );
}
