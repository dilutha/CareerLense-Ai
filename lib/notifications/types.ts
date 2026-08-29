import type { NotificationType } from "./schemas";

export interface NotificationRow {
  id: string;
  profile_id: string;
  type: NotificationType;
  title: string;
  message: string;
  related_application_id: string | null;
  related_job_id: string | null;
  related_status_history_id: string | null;
  scheduled_for: string;
  read_at: string | null;
  sent_at: string | null;
  created_at: string;
}
