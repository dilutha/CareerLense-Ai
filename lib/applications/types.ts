import type { ApplicationStatus } from "./schemas";

export interface ApplicationRow {
  id: string;
  profile_id: string;
  job_id: string;
  application_document_id: string | null;
  status: ApplicationStatus;
  notes: string | null;
  follow_up_date: string | null;
  interview_at: string | null;
  applied_at: string | null;
  last_status_changed_at: string;
  created_at: string;
  updated_at: string;
}

export interface ApplicationStatusHistoryRow {
  id: string;
  application_id: string;
  profile_id: string;
  old_status: ApplicationStatus | null;
  new_status: ApplicationStatus;
  changed_at: string;
  note: string | null;
}
