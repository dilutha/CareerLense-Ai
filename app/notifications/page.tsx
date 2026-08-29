import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { getNotificationsForUser } from "@/lib/notifications/get-notifications";
import { NotificationList } from "@/components/notifications/NotificationList";

export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  const notifications = await getNotificationsForUser(user.id);

  return (
    <main className="min-h-dvh bg-sea-gradient-soft px-6 py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <Link
          href="/career"
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-navy-light/70 hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to career dashboard
        </Link>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-navy sm:text-3xl">Notifications</h1>
          <p className="text-sm text-navy-light/70">Follow-ups, interview reminders, and status updates.</p>
        </div>

        <NotificationList notifications={notifications} />
      </div>
    </main>
  );
}
