import type { ResumeWithAnalysis } from "@/lib/resume/types";
import { ResumeCard } from "./ResumeCard";
import { ResumeUploader } from "./ResumeUploader";

export function ResumeList({ resumes }: { resumes: ResumeWithAnalysis[] }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-navy">Your CV</p>
        <p className="text-sm text-navy-light/60">
          {resumes.length === 0
            ? "Your CV can help me give you much better advice."
            : "Upload another version any time — a general CV, or one tailored to a role."}
        </p>
      </div>

      {resumes.length > 0 && (
        <div className="flex flex-col gap-3">
          {resumes.map((item) => (
            <ResumeCard key={item.resume.id} item={item} />
          ))}
        </div>
      )}

      <ResumeUploader />
    </div>
  );
}
