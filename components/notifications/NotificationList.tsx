"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Check, CheckCheck } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications/actions";
import { NOTIFICATION_TYPE_LABELS } from "@/lib/notifications/schemas";
import type { NotificationRow } from "@/lib/notifications/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function NotificationList({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  function handleMarkRead(id: string) {
    startTransition(async () => {
      await markNotificationRead(id);
      router.refresh();
    });
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-navy/10 bg-white p-8 text-center">
        <Bell className="h-6 w-6 text-navy-light/30" aria-hidden="true" />
        <p className="text-sm text-navy-light/70">
          No notifications yet — set a follow-up date or interview time on a tracked application to get reminders.
        </p>
        <Link href="/applications" className="mt-1 text-sm font-medium text-ocean hover:text-navy">
          Go to /applications
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {unreadCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-navy-light/70">{unreadCount} unread</p>
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={pending}
            className="flex items-center gap-1 text-sm font-medium text-ocean hover:text-navy disabled:opacity-60"
          >
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Mark all as read
          </button>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {notifications.map((n) => (
          <li
            key={n.id}
            className={`rounded-2xl border p-4 shadow-sm ${
              n.read_at ? "border-navy/10 bg-white" : "border-ocean/30 bg-ocean/5"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-light/50">
                  {NOTIFICATION_TYPE_LABELS[n.type]}
                </p>
                <p className="mt-0.5 text-sm font-medium text-navy">{n.title}</p>
                <p className="mt-1 text-sm text-navy-light/70">{n.message}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-navy-light/50">
                  <span>{formatDate(n.scheduled_for)}</span>
                  {n.related_application_id && (
                    <Link href={`/applications/${n.related_application_id}`} className="font-medium text-ocean hover:text-navy">
                      View application
                    </Link>
                  )}
                </div>
              </div>
              {!n.read_at && (
                <button
                  type="button"
                  onClick={() => handleMarkRead(n.id)}
                  disabled={pending}
                  aria-label="Mark as read"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-navy-light/50 hover:bg-navy/5 hover:text-navy disabled:opacity-60"
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
