export type TimeEntry = {
  id: string;
  user_id: string;
  case_id: string | null;
  task_id: string | null;
  started_at: string;
  ended_at: string | null;
  minutes: number | null;
  billable: boolean;
  description: string | null;
};

export type TimeEntryListItem = TimeEntry & {
  cases: { code: string; title: string } | null;
  tasks: { title: string } | null;
};

export type MemberRate = {
  id: string;
  user_id: string;
  cost_per_hour: number;
  price_per_hour: number;
  valid_from: string;
};

export type NotificationRow = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export type TimeFormState = { error?: string; ok?: boolean; values?: Record<string, string> } | undefined;
