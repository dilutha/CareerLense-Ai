import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { InterviewSessionView } from "@/components/interview/InterviewSessionView";
import { requireUser } from "@/lib/auth/require-user";
import { getInterviewSession } from "@/lib/interview/get-interview";

export default async function InterviewSessionPage(props: PageProps<"/interview/[sessionId]">) {
  const { sessionId } = await props.params;
  const user = await requireUser(`/interview/${sessionId}`);

  const result = await getInterviewSession(user.id, sessionId);
  if (!result) notFound();

  return (
    <main className="min-h-dvh bg-sea-gradient-soft px-6 py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <Link
          href="/interview"
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-navy-light/70 hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to interview coach
        </Link>

        <InterviewSessionView session={result.session} initialExchanges={result.exchanges} />
      </div>
    </main>
  );
}
