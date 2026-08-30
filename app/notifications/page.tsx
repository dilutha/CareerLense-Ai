import { BackLink } from "@/components/ui/BackLink";
import { requireUser } from "@/lib/auth/require-user";
import { getNotificationsForUser } from "@/lib/notifications/get-notifications";
import { NotificationList } from "@/components/notifications/NotificationList";

export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  const notifications = await getNotificationsForUser(user.id);

  return (
    <main className="min-h-dvh bg-sea-gradient-soft px-6 py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <BackLink href="/career" label="Back to career dashboard" />

        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-navy sm:text-3xl">Notifications</h1>
          <p className="text-sm text-navy-light/70">Follow-ups, interview reminders, and status updates.</p>
        </div>

        <NotificationList notifications={notifications} />
      </div>
    </main>
  );
}
