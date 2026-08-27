import type { ApplicationDocumentVersion, CoverLetterRow } from "@/lib/application/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function VersionHistory({
  cvVersions,
  coverLetters,
  jobTitle,
  onSelectCv,
  onSelectCoverLetter,
  selectedCvVersion,
  selectedCoverLetterVersion,
}: {
  cvVersions: ApplicationDocumentVersion[];
  coverLetters: CoverLetterRow[];
  jobTitle: string;
  onSelectCv: (version: ApplicationDocumentVersion) => void;
  onSelectCoverLetter: (letter: CoverLetterRow) => void;
  selectedCvVersion: number | null;
  selectedCoverLetterVersion: number | null;
}) {
  if (cvVersions.length === 0 && coverLetters.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-navy">Version history</p>

      {cvVersions.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-navy-light/50">
            Tailored CV
          </p>
          <ul className="flex flex-col gap-1">
            {cvVersions.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => onSelectCv(v)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm ${
                    selectedCvVersion === v.version_number
                      ? "bg-foam font-medium text-navy"
                      : "text-navy-light/70 hover:bg-foam"
                  }`}
                >
                  <span>
                    v{v.version_number} — for {jobTitle}
                  </span>
                  <span className="text-xs text-navy-light/50">
                    {formatDate(v.created_at)}
                    {v.keyword_alignment_after != null && ` · ${v.keyword_alignment_after}%`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {coverLetters.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-navy-light/50">
            Cover letter
          </p>
          <ul className="flex flex-col gap-1">
            {coverLetters.map((letter) => (
              <li key={letter.id}>
                <button
                  type="button"
                  onClick={() => onSelectCoverLetter(letter)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm ${
                    selectedCoverLetterVersion === letter.version_number
                      ? "bg-foam font-medium text-navy"
                      : "text-navy-light/70 hover:bg-foam"
                  }`}
                >
                  <span>v{letter.version_number}</span>
                  <span className="text-xs text-navy-light/50">{formatDate(letter.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
