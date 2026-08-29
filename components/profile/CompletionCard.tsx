import { Check } from "lucide-react";
import type { ProfileCompletion } from "@/lib/career-profile/completion";

/**
 * A ✓/○ checklist, never a bare "45% complete — fill 10 more forms"
 * number (Part 23) — profile completion is progressive and optional, not
 * a gate on using CareerLens.
 */
export function CompletionCard({ completion }: { completion: ProfileCompletion }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-navy">Your Career Profile is getting stronger 💙</p>
        <span className="text-sm font-semibold text-ocean">{completion.percent}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-foam">
        <div
          className="h-full rounded-full bg-sea-gradient transition-all duration-500"
          style={{ width: `${completion.percent}%` }}
        />
      </div>
      <ul className="flex flex-col gap-1.5 pt-1 text-sm">
        {completion.items.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            {item.done ? (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sea-gradient text-white">
                <Check className="h-2.5 w-2.5" aria-hidden="true" strokeWidth={3} />
              </span>
            ) : (
              <span className="h-4 w-4 shrink-0 rounded-full border-2 border-navy/15" aria-hidden="true" />
            )}
            <span className={item.done ? "text-navy-light/60 line-through" : "text-navy"}>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
