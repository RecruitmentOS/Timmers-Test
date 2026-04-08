/**
 * Task status. v1 keeps it simple: open | completed. No `in_progress`.
 */
export type TaskStatus = "open" | "completed";

/**
 * Task priority. Matches the Drizzle `task_priority` enum exactly.
 * NOTE: There is NO "normal" value — use "medium" as the default.
 */
export type TaskPriority = "low" | "medium" | "high" | "urgent";

/**
 * Task — single source of truth shape for the tasks table.
 * Field names match the Drizzle schema 1:1 (camelCased from snake_case).
 * Phase 02-02 (backend services) and Phase 02-04 (frontend) both import this.
 */
export interface Task {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  candidateId: string | null;
  vacancyId: string | null;
  clientId: string | null;
  assignedToUserId: string;
  createdByUserId: string;
  dueDate: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  completedAt: string | null;
  completedByUserId: string | null;
  autoCreatedFromStageId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating a new task.
 * Exactly one of candidateId / vacancyId / clientId must be provided
 * (enforced by DB CHECK constraint `task_exactly_one_parent`).
 */
export interface CreateTaskInput {
  title: string;
  description?: string;
  candidateId?: string;
  vacancyId?: string;
  clientId?: string;
  assignedToUserId: string;
  dueDate?: string;
  priority?: TaskPriority;
}

/**
 * Input for updating an existing task.
 */
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  assignedToUserId?: string;
  dueDate?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
}

/**
 * Filters for the tasks list query.
 * `assignedTo` (not `assignedToUserId`) is the filter key used by
 * the tasks page, matching Plan 02-02's TaskFilters shape.
 */
export interface TaskFilters {
  assignedTo?: string;
  status?: TaskStatus;
  dueBefore?: string;
  dueAfter?: string;
  vacancyId?: string;
}
