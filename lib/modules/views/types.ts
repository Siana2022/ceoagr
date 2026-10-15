export type SavedView = {
  id: string;
  user_id: string;
  entity: "contacts" | "cases" | "tasks" | "opportunities";
  name: string;
  filters: Record<string, string>;
  columns: string[];
  is_shared: boolean;
};
