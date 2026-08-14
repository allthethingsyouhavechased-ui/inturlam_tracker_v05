import { getDb, plainList, plainOne } from "@/lib/db/client";
import type { CalendarEventReport, CalendarEventType } from "@/lib/types";

export interface ReportableCalendarEvent extends CalendarEventReport {
  event_id: string;
  brand_id: string;
  brand_name: string;
  event_title: string;
  event_type: Extract<CalendarEventType, "Toplanti" | "Cekim">;
  start_at: string;
  end_at: string;
  all_day: number;
  location: string | null;
}

export interface ReportableEventIdentity {
  id: string;
  brand_id: string;
  brand_name: string;
  title: string;
  type: Extract<CalendarEventType, "Toplanti" | "Cekim">;
}

export function getReportableCalendarEvent(eventId: string): ReportableEventIdentity | undefined {
  return plainOne<ReportableEventIdentity>(getDb().prepare(
    `SELECT e.id, e.brand_id, b.name AS brand_name, e.title, e.type
       FROM calendar_events e
       JOIN brands b ON b.id = e.brand_id
      WHERE e.id = ? AND e.deleted_at IS NULL AND e.type IN ('Toplanti','Cekim')`,
  ).get(eventId));
}

export function listBrandCalendarEventReports(input: {
  brandId: string;
  rangeStart: string;
  rangeEnd: string;
  type?: Extract<CalendarEventType, "Toplanti" | "Cekim"> | null;
}): ReportableCalendarEvent[] {
  const conditions = [
    "e.brand_id = :brandId",
    "e.deleted_at IS NULL",
    "e.type IN ('Toplanti','Cekim')",
    "e.start_at < :rangeEnd",
    "e.end_at > :rangeStart",
  ];
  const params: Record<string, string> = {
    brandId: input.brandId,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
  };
  if (input.type) {
    conditions.push("e.type = :type");
    params.type = input.type;
  }

  return plainList<ReportableCalendarEvent>(getDb().prepare(
    `SELECT
       e.id AS event_id,
       e.brand_id,
       b.name AS brand_name,
       e.title AS event_title,
       e.type AS event_type,
       e.start_at,
       e.end_at,
       e.all_day,
       e.location,
       r.participants,
       r.summary,
       r.decisions,
       r.next_steps,
       r.updated_by_id,
       p.name AS updated_by_name,
       r.created_at,
       r.updated_at AS report_updated_at
     FROM calendar_events e
     JOIN brands b ON b.id = e.brand_id
     LEFT JOIN calendar_event_reports r ON r.event_id = e.id
     LEFT JOIN people p ON p.id = r.updated_by_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY e.start_at DESC, e.title`,
  ).all(params));
}

export function saveCalendarEventReport(input: {
  eventId: string;
  participants: string | null;
  summary: string | null;
  decisions: string | null;
  nextSteps: string | null;
  updatedById: string;
}): "saved" | "cleared" {
  const event = getReportableCalendarEvent(input.eventId);
  if (!event) throw new Error("Raporlanabilir toplantı veya çekim bulunamadı.");

  const hasContent = Boolean(input.participants || input.summary || input.decisions || input.nextSteps);
  if (!hasContent) {
    getDb().prepare("DELETE FROM calendar_event_reports WHERE event_id = ?").run(input.eventId);
    return "cleared";
  }

  getDb().prepare(
    `INSERT INTO calendar_event_reports
       (event_id, participants, summary, decisions, next_steps, updated_by_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(event_id) DO UPDATE SET
       participants = excluded.participants,
       summary = excluded.summary,
       decisions = excluded.decisions,
       next_steps = excluded.next_steps,
       updated_by_id = excluded.updated_by_id,
       updated_at = datetime('now')`,
  ).run(
    input.eventId,
    input.participants,
    input.summary,
    input.decisions,
    input.nextSteps,
    input.updatedById,
  );
  return "saved";
}
