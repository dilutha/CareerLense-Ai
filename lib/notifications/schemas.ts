export const NOTIFICATION_TYPES = [
  "application_follow_up",
  "interview_reminder",
  "application_deadline",
  "status_change",
  "action_required",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  application_follow_up: "Follow-up reminder",
  interview_reminder: "Interview reminder",
  application_deadline: "Application deadline",
  status_change: "Status update",
  action_required: "Action needed",
};

export function isValidNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}
