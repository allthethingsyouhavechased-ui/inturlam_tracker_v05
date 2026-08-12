import { isGoogleCalendarConfigured } from "@/lib/calendar/google";
import { getCalendarSyncQueueCounts, getCalendarSyncState } from "@/lib/repositories/calendarEvents";

export type CalendarSchedulerStatus = "active" | "stale" | "unknown";
export type CalendarSyncOverallStatus = "unconfigured" | "error" | "pending" | "healthy" | "waiting";

export interface CalendarSyncHealth {
  configured: boolean;
  pendingCount: number;
  errorCount: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  schedulerLastSeenAt: string | null;
  schedulerStatus: CalendarSchedulerStatus;
  overallStatus: CalendarSyncOverallStatus;
}

const SCHEDULER_STALE_AFTER_MS = 12 * 60 * 1000;

export function getCalendarSyncHealth(options: {
  configured?: boolean;
  now?: Date;
} = {}): CalendarSyncHealth {
  const configured = options.configured ?? isGoogleCalendarConfigured();
  const now = options.now ?? new Date();
  const counts = getCalendarSyncQueueCounts();
  const lastAttemptAt = getCalendarSyncState("calendar_last_attempt_at");
  const lastSuccessAt = getCalendarSyncState("calendar_last_success_at");
  const lastFailureAt = getCalendarSyncState("calendar_last_failure_at");
  const lastError = getCalendarSyncState("calendar_last_error");
  const schedulerLastSeenAt = getCalendarSyncState("calendar_scheduler_last_seen_at");

  let schedulerStatus: CalendarSchedulerStatus = "unknown";
  if (schedulerLastSeenAt) {
    const elapsed = now.getTime() - Date.parse(schedulerLastSeenAt);
    schedulerStatus = Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= SCHEDULER_STALE_AFTER_MS
      ? "active"
      : "stale";
  }

  let overallStatus: CalendarSyncOverallStatus;
  if (!configured) overallStatus = "unconfigured";
  else if (counts.errorCount > 0 || (lastFailureAt && (!lastSuccessAt || lastFailureAt > lastSuccessAt))) overallStatus = "error";
  else if (counts.pendingCount > 0) overallStatus = "pending";
  else if (lastSuccessAt) overallStatus = "healthy";
  else overallStatus = "waiting";

  return {
    configured,
    ...counts,
    lastAttemptAt,
    lastSuccessAt,
    lastFailureAt,
    lastError,
    schedulerLastSeenAt,
    schedulerStatus,
    overallStatus,
  };
}
