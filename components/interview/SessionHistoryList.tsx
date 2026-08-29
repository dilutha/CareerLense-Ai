import Link from "next/link";
import type { InterviewSessionRow } from "@/lib/interview/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function SessionHistoryList({ sessions }: { sessions: InterviewSessionRow[] }) {
  if (sessions.length === 0) return null;

  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
      <p className="mb-3 text-sm font-semibold text-navy">Previous sessions</p>
      <ul className="flex flex-col gap-1.5">
        {sessions.map((session) => (
          <li key={session.id}>
            <Link
              href={`/interview/${session.id}`}
              className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm text-navy-light/70 hover:bg-foam hover:text-navy"
            >
              <span>{formatDate(session.created_at)}</span>
              <span className={session.status === "completed" ? "text-emerald-600" : "text-amber-600"}>
                {session.status === "completed" ? "Completed" : "In progress"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
