import type { ProfileCompletion } from "@/lib/career-profile/completion";

export function CompletionCard({ completion }: { completion: ProfileCompletion }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-navy">Profile completeness</p>
        <span className="text-sm font-semibold text-ocean">{completion.percent}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-foam">
        <div
          className="h-full rounded-full bg-sea-gradient transition-all duration-500"
          style={{ width: `${completion.percent}%` }}
        />
      </div>
      {completion.missing.length > 0 && (
        <ul className="flex flex-col gap-1 pt-1 text-sm text-navy-light/70">
          {completion.missing.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-navy/20" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
