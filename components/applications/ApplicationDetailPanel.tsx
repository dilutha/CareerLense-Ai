"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  setFollowUpDate,
  setInterviewAt,
  updateApplicationNotes,
  updateApplicationStatus,
} from "@/lib/applications/actions";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/applications/schemas";
import type { ApplicationDetail } from "@/lib/applications/get-applications";
import { fromColomboParts, toColomboParts } from "@/lib/notifications/colombo-time";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Formats a UTC ISO instant as a Colombo-local value for a `datetime-local` input. */
function toDateTimeLocalValue(iso: string): string {
  const p = toColomboParts(new Date(iso));
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Parses a `datetime-local` value (interpreted as Colombo-local) back into a real UTC ISO instant. */
function fromDateTimeLocalValue(value: string): string | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  return fromColomboParts(year, month - 1, day, hour, minute).toISOString();
}

export function ApplicationDetailPanel({ detail }: { detail: ApplicationDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(detail.application.notes ?? "");
  const [followUp, setFollowUp] = useState(detail.application.follow_up_date ?? "");
  const [interviewAt, setInterviewAtValue] = useState(
    detail.application.interview_at ? toDateTimeLocalValue(detail.application.interview_at) : ""
  );

  function handleStatusChange(status: ApplicationStatus) {
    startTransition(async () => {
      await updateApplicationStatus(detail.application.id, status);
      router.refresh();
    });
  }

  function handleSaveNotes() {
    startTransition(async () => {
      await updateApplicationNotes(detail.application.id, notes);
      router.refresh();
    });
  }

  function handleSaveFollowUp() {
    startTransition(async () => {
      await setFollowUpDate(detail.application.id, followUp || null);
      router.refresh();
    });
  }

  function handleSaveInterviewAt() {
    startTransition(async () => {
      const iso = interviewAt ? fromDateTimeLocalValue(interviewAt) : null;
      await setInterviewAt(detail.application.id, iso);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-light/50">Status</p>
        <select
          value={detail.application.status}
          onChange={(e) => handleStatusChange(e.target.value as ApplicationStatus)}
          disabled={pending}
          className="w-full rounded-xl border border-navy/10 bg-foam px-3.5 py-2 text-sm text-navy disabled:opacity-60"
        >
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {APPLICATION_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        {detail.match && (
          <p className="mt-3 text-sm text-navy-light/70">
            Match score: <span className="font-semibold text-navy">{detail.match.match_score}%</span>
            {detail.match.missing_required_skills.length > 0 && (
              <span> · Missing: {detail.match.missing_required_skills.slice(0, 4).join(", ")}</span>
            )}
          </p>
        )}
      </div>

      {(detail.cvVersion || detail.coverLetter) && (
        <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-light/50">
            Applied with
          </p>
          <p className="text-sm text-navy">
            {detail.cvVersion && <>CV Version {detail.cvVersion.version_number}</>}
            {detail.cvVersion && detail.coverLetter && " · "}
            {detail.coverLetter && <>Cover Letter Version {detail.coverLetter.version_number}</>}
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-light/50">Follow up on</p>
        <div className="flex gap-2">
          <input
            type="date"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            className="flex-1 rounded-xl border border-navy/10 bg-foam px-3.5 py-2 text-sm text-navy"
          />
          <button
            type="button"
            onClick={handleSaveFollowUp}
            disabled={pending}
            className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Save"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-light/50">Interview date &amp; time</p>
        <p className="mb-2 text-xs text-navy-light/50">Set this to get reminders 24 hours and 1 hour before (Asia/Colombo time).</p>
        <div className="flex gap-2">
          <input
            type="datetime-local"
            value={interviewAt}
            onChange={(e) => setInterviewAtValue(e.target.value)}
            className="flex-1 rounded-xl border border-navy/10 bg-foam px-3.5 py-2 text-sm text-navy"
          />
          <button
            type="button"
            onClick={handleSaveInterviewAt}
            disabled={pending}
            className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Save"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-light/50">Notes</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Recruiter contact, interview format, anything worth remembering..."
          className="w-full rounded-xl border border-navy/10 bg-foam px-3.5 py-2.5 text-sm text-navy placeholder:text-navy-light/50"
        />
        <button
          type="button"
          onClick={handleSaveNotes}
          disabled={pending}
          className="mt-2 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Save notes
        </button>
      </div>

      {detail.statusHistory.length > 0 && (
        <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy-light/50">
            Status history
          </p>
          <ul className="flex flex-col gap-2 border-l-2 border-navy/10 pl-4">
            {detail.statusHistory.map((h) => (
              <li key={h.id} className="text-sm">
                <span className="font-medium text-navy">
                  {h.old_status ? `${APPLICATION_STATUS_LABELS[h.old_status]} → ` : ""}
                  {APPLICATION_STATUS_LABELS[h.new_status]}
                </span>
                <span className="ml-2 text-xs text-navy-light/50">{formatDate(h.changed_at)}</span>
                {h.note && <p className="text-xs text-navy-light/60">{h.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
