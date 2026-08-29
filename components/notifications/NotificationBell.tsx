import Link from "next/link";
import { Bell } from "lucide-react";
import { getUnreadNotificationCount } from "@/lib/notifications/get-notifications";

export async function NotificationBell({ userId }: { userId: string }) {
  const unreadCount = await getUnreadNotificationCount(userId);

  return (
    <Link
      href="/notifications"
      aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
      className="relative flex h-9 w-9 items-center justify-center rounded-full border border-navy/10 bg-white text-navy-light/70 shadow-sm hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean"
    >
      <Bell className="h-4 w-4" aria-hidden="true" />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ocean px-1 text-[10px] font-semibold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
