import { getDb, plainList, plainOne } from "@/lib/db/client";
import type { CalendarEvent, CalendarEventType } from "@/lib/types";

export interface CalendarEventInput {
  id?: string;
  brandId: string | null;
  type: CalendarEventType;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location: string | null;
  guestVisible: boolean;
  accountId: string;
}

const SELECT_EVENT = `SELECT e.*, b.name AS brand_name
  FROM calendar_events e LEFT JOIN brands b ON b.id = e.brand_id`;

export function listCalendarEvents(input: {
  rangeStart: string;
  rangeEnd: string;
  brandId?: string | null;
  type?: CalendarEventType | null;
  includeDeleted?: boolean;
}): CalendarEvent[] {
  const conditions = ["e.start_at < :rangeEnd", "e.end_at >= :rangeStart"];
  const params: Record<string, string> = { rangeStart: input.rangeStart, rangeEnd: input.rangeEnd };
  if (!input.includeDeleted) conditions.push("e.deleted_at IS NULL");
  if (input.brandId) { conditions.push("e.brand_id = :brandId"); params.brandId = input.brandId; }
  if (input.type) { conditions.push("e.type = :type"); params.type = input.type; }
  return plainList<CalendarEvent>(getDb().prepare(
    `${SELECT_EVENT} WHERE ${conditions.join(" AND ")} ORDER BY e.start_at, e.end_at, e.title`,
  ).all(params));
}

export function listGuestCalendarEvents(brandId: string, rangeStart: string, rangeEnd: string): CalendarEvent[] {
  return plainList<CalendarEvent>(getDb().prepare(
    `${SELECT_EVENT}
      WHERE e.brand_id = ? AND e.guest_visible = 1 AND e.deleted_at IS NULL
        AND e.start_at < ? AND e.end_at >= ?
      ORDER BY e.start_at, e.end_at, e.title`,
  ).all(brandId, rangeEnd, rangeStart));
}

export function getCalendarEvent(id: string): CalendarEvent | undefined {
  return plainOne<CalendarEvent>(getDb().prepare(`${SELECT_EVENT} WHERE e.id = ?`).get(id));
}

export function saveCalendarEvent(input: CalendarEventInput): string {
  const id = input.id ?? crypto.randomUUID();
  const existing = input.id ? getCalendarEvent(input.id) : undefined;
  if (input.id && !existing) throw new Error("Etkinlik bulunamadı.");
  if (existing) {
    getDb().prepare(
      `UPDATE calendar_events SET brand_id = ?, type = ?, title = ?, description = ?,
         start_at = ?, end_at = ?, all_day = ?, location = ?, guest_visible = ?,
         sync_status = 'pending', sync_error = NULL, deleted_at = NULL,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    ).run(input.brandId, input.type, input.title, input.description, input.startAt, input.endAt,
      input.allDay ? 1 : 0, input.location, input.guestVisible ? 1 : 0, id);
  } else {
    getDb().prepare(
      `INSERT INTO calendar_events
         (id, brand_id, type, title, description, start_at, end_at, all_day, location,
          guest_visible, created_by_account_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
    ).run(id, input.brandId, input.type, input.title, input.description, input.startAt, input.endAt,
      input.allDay ? 1 : 0, input.location, input.guestVisible ? 1 : 0, input.accountId);
  }
  return id;
}

export function cancelCalendarEvent(id: string): void {
  const result = getDb().prepare(
    `UPDATE calendar_events SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       sync_status = 'pending', sync_error = NULL,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND deleted_at IS NULL`,
  ).run(id);
  if (result.changes !== 1) throw new Error("Etkinlik bulunamadı.");
}

export function listPendingCalendarEvents(): CalendarEvent[] {
  return plainList<CalendarEvent>(getDb().prepare(
    `${SELECT_EVENT} WHERE e.sync_status IN ('pending','error') ORDER BY e.updated_at LIMIT 100`,
  ).all());
}

export function markCalendarEventSynced(input: {
  id: string; googleEventId: string | null; etag: string | null; googleUpdatedAt: string | null;
}): void {
  getDb().prepare(
    `UPDATE calendar_events SET google_event_id = ?, google_etag = ?, google_updated_at = ?,
       sync_status = 'synced', sync_error = NULL, last_synced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ?`,
  ).run(input.googleEventId, input.etag, input.googleUpdatedAt, input.id);
}

export function markCalendarEventSyncError(id: string, error: string): void {
  getDb().prepare(
    `UPDATE calendar_events SET sync_status = 'error', sync_error = ? WHERE id = ?`,
  ).run(error.slice(0, 1000), id);
}

export interface GoogleCalendarEventRecord {
  googleEventId: string;
  trackerId: string | null;
  etag: string | null;
  updatedAt: string;
  status: string;
  brandId: string | null;
  type: CalendarEventType;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location: string | null;
  guestVisible: boolean;
}

export function applyInboundGoogleEvent(remote: GoogleCalendarEventRecord): "inserted" | "updated" | "ignored" {
  const db = getDb();
  const validBrandId = remote.brandId && db.prepare("SELECT 1 FROM brands WHERE id = ?").get(remote.brandId)
    ? remote.brandId : null;
  const local = plainOne<CalendarEvent>(db.prepare(
    `SELECT * FROM calendar_events WHERE google_event_id = ? OR id = ? LIMIT 1`,
  ).get(remote.googleEventId, remote.trackerId ?? ""));
  if (local && local.sync_status === "pending" && Date.parse(local.updated_at) > Date.parse(remote.updatedAt)) return "ignored";
  const deletedAt = remote.status === "cancelled" ? remote.updatedAt : null;
  if (local) {
    if (remote.status === "cancelled") {
      db.prepare(
        `UPDATE calendar_events SET google_event_id = ?, google_etag = ?, google_updated_at = ?,
           sync_status = 'synced', sync_error = NULL, deleted_at = ?, updated_at = ?,
           last_synced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
      ).run(remote.googleEventId, remote.etag, remote.updatedAt, deletedAt, remote.updatedAt, local.id);
      return "updated";
    }
    db.prepare(
      `UPDATE calendar_events SET brand_id = ?, type = ?, title = ?, description = ?, start_at = ?, end_at = ?,
         all_day = ?, location = ?, guest_visible = ?, google_event_id = ?, google_etag = ?, google_updated_at = ?,
         sync_status = 'synced', sync_error = NULL, deleted_at = ?, updated_at = ?, last_synced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?`,
    ).run(validBrandId, remote.type, remote.title, remote.description, remote.startAt, remote.endAt,
      remote.allDay ? 1 : 0, remote.location, remote.guestVisible ? 1 : 0, remote.googleEventId,
      remote.etag, remote.updatedAt, deletedAt, remote.updatedAt, local.id);
    return "updated";
  }
  if (remote.status === "cancelled") return "ignored";
  db.prepare(
    `INSERT INTO calendar_events
       (id, brand_id, type, title, description, start_at, end_at, all_day, location, guest_visible,
        google_event_id, google_etag, google_updated_at, sync_status, deleted_at, created_at, updated_at, last_synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', NULL, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
  ).run(remote.trackerId ?? crypto.randomUUID(), validBrandId, remote.type, remote.title,
    remote.description, remote.startAt, remote.endAt, remote.allDay ? 1 : 0, remote.location,
    remote.guestVisible ? 1 : 0, remote.googleEventId, remote.etag, remote.updatedAt,
    remote.updatedAt, remote.updatedAt);
  return "inserted";
}

export function getCalendarSyncState(key: string): string | null {
  return (plainOne<{ value: string | null }>(getDb().prepare("SELECT value FROM calendar_sync_state WHERE key = ?").get(key))?.value) ?? null;
}

export function setCalendarSyncState(key: string, value: string): void {
  getDb().prepare(
    `INSERT INTO calendar_sync_state (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
  ).run(key, value);
}
