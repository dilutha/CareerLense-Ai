import Link from "next/link";
import { toColomboParts } from "@/lib/notifications/colombo-time";
import type { UpcomingItem } from "@/lib/notifications/get-notifications";

function dayLabel(scheduledFor: string, now: Date): string {
  const target = toColomboParts(new Date(scheduledFor));
  const today = toColomboParts(now);

  const targetDays = Date.UTC(target.year, target.month, target.day);
  const todayDays = Date.UTC(today.year, today.month, today.day);
  const diffDays = Math.round((targetDays - todayDays) / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) return "TODAY";
  if (diffDays === 1) return "TOMORROW";
  return `IN ${diffDays} DAYS`;
}

/** A simple, flat "what's coming up" list — deliberately not a calendar (Part 10: "do not turn the dashboard into a complicated calendar application"). */
export function UpcomingWidget({ items }: { items: UpcomingItem[] }) {
  if (items.length === 0) return null;

  const now = new Date();

  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
      <p className="mb-3 text-sm font-semibold text-navy">Upcoming</p>
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="shrink-0 rounded-full bg-foam px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-navy-light/60">
              {dayLabel(item.scheduledFor, now)}
            </span>
            {item.relatedApplicationId ? (
              <Link
                href={`/applications/${item.relatedApplicationId}`}
                className="flex-1 truncate text-navy hover:text-ocean"
              >
                {item.title}
              </Link>
            ) : (
              <span className="flex-1 truncate text-navy">{item.title}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
