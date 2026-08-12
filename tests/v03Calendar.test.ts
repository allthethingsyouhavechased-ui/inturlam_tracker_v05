import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-v03-calendar-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;
const { getDb } = await import("@/lib/db/client");
const { applyInboundGoogleEvent, getCalendarEvent, listCalendarEvents, listGuestCalendarEvents, listPendingCalendarEvents, markCalendarEventSyncError, saveCalendarEvent } = await import("@/lib/repositories/calendarEvents");
const { notifyGuestCalendarEvent } = await import("@/lib/notifications");
const { listNotificationsForRecipient } = await import("@/lib/repositories/notifications");
const { calendarEventTone } = await import("@/lib/calendar/colors");
const { calendarEventStartDate, eventOccursOnDate, normalizeCalendarFormRange } = await import("@/lib/calendar/time");
const { calendarEventToGoogleBody } = await import("@/lib/calendar/google");

function resetDb() { globalThis.__inturlamDb?.close(); globalThis.__inturlamDb = undefined; for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(TMP_DB + suffix, { force: true }); }
function seed() { const db = getDb(); db.prepare("INSERT INTO brands (id,name,cluster) VALUES ('b1','Bir','tek'),('b2','İki','tek')").run(); db.prepare("INSERT INTO people (id,name) VALUES ('p1','Ada')").run(); db.prepare("INSERT INTO accounts (id,kind,person_id) VALUES ('team:p1','team','p1')").run(); return db; }
beforeEach(resetDb); after(resetDb);

describe("v03 etkinlik takvimi", () => {
  it("guest yalnızca kendi markasının açıkça paylaşılmış etkinliğini görür", () => {
    seed();
    for (const [brandId, visible, title] of [["b1", true, "Açık"], ["b1", false, "İç"], ["b2", true, "Başka"]] as const) saveCalendarEvent({ brandId, type: "Toplanti", title, description: null, startAt: "2026-08-10T09:00:00Z", endAt: "2026-08-10T10:00:00Z", allDay: false, location: null, guestVisible: visible, accountId: "team:p1" });
    assert.deepEqual(listGuestCalendarEvents("b1", "2026-08-01", "2026-09-01").map((event) => event.title), ["Açık"]);
  });

  it("aynı Google olayı tekrar geldiğinde ikinci kayıt oluşturmaz ve iptali tombstone yapar", () => {
    const db = seed();
    const remote = { googleEventId: "google-1", trackerId: null, etag: "e1", updatedAt: "2026-08-10T10:00:00Z", status: "confirmed", brandId: null, type: "Toplanti" as const, title: "Google toplantısı", description: null, startAt: "2026-08-12T09:00:00Z", endAt: "2026-08-12T10:00:00Z", allDay: false, location: null, guestVisible: false };
    assert.equal(applyInboundGoogleEvent(remote), "inserted");
    assert.equal(applyInboundGoogleEvent({ ...remote, etag: "e2", updatedAt: "2026-08-10T11:00:00Z" }), "updated");
    assert.equal((db.prepare("SELECT COUNT(*) c FROM calendar_events").get() as { c: number }).c, 1);
    applyInboundGoogleEvent({ ...remote, status: "cancelled", updatedAt: "2026-08-10T12:00:00Z" });
    assert.ok((db.prepare("SELECT deleted_at FROM calendar_events").get() as { deleted_at: string }).deleted_at);
  });

  it("marka/tür filtrelerini uygular ve başarısız outbound işi tekrar kuyruğunda tutar", () => {
    seed();
    const id = saveCalendarEvent({ brandId: "b1", type: "Cekim", title: "Çekim", description: null, startAt: "2026-08-10T09:00:00Z", endAt: "2026-08-10T10:00:00Z", allDay: false, location: null, guestVisible: false, accountId: "team:p1" });
    saveCalendarEvent({ brandId: "b2", type: "Toplanti", title: "Toplantı", description: null, startAt: "2026-08-10T09:00:00Z", endAt: "2026-08-10T10:00:00Z", allDay: false, location: null, guestVisible: false, accountId: "team:p1" });
    assert.deepEqual(listCalendarEvents({ rangeStart: "2026-08-01", rangeEnd: "2026-09-01", brandId: "b1", type: "Cekim" }).map((event) => event.title), ["Çekim"]);
    markCalendarEventSyncError(id, "geçici kesinti");
    assert.ok(listPendingCalendarEvents().some((event) => event.id === id));
  });

  it("etkinlik rengini kaydeder, listeler ve Google inbound akışında korur", () => {
    seed();
    const id = saveCalendarEvent({ brandId: "b1", type: "Cekim", colorKey: "rose", title: "Renkli çekim", description: null, startAt: "2026-08-10T09:00:00Z", endAt: "2026-08-10T10:00:00Z", allDay: false, location: null, guestVisible: false, accountId: "team:p1" });
    const local = listCalendarEvents({ rangeStart: "2026-08-01", rangeEnd: "2026-09-01" }).find((event) => event.id === id)!;
    assert.equal(local.color_key, "rose");
    assert.match(calendarEventTone(local), /rose/);
    const googleBody = calendarEventToGoogleBody(getCalendarEvent(id)!) as { colorId?: string; extendedProperties: { private: Record<string, string> } };
    assert.equal(googleBody.colorId, "11");
    assert.equal(googleBody.extendedProperties.private.inturlamColorKey, "rose");

    applyInboundGoogleEvent({ googleEventId: "google-color", trackerId: null, etag: "e1", updatedAt: "2026-08-10T10:00:00Z", status: "confirmed", brandId: null, type: "Toplanti", colorKey: "green", title: "Google renk", description: null, startAt: "2026-08-12T09:00:00Z", endAt: "2026-08-12T10:00:00Z", allDay: false, location: null, guestVisible: false });
    assert.equal(listCalendarEvents({ rangeStart: "2026-08-01", rangeEnd: "2026-09-01" }).find((event) => event.google_event_id === "google-color")?.color_key, "green");
  });

  it("guest paylaşımını markasız etkinlikte reddeder ve bozuk aralığı saklamaz", () => {
    seed();
    const base = { type: "Toplanti" as const, title: "Invalid", description: null, startAt: "2026-08-10T09:00:00Z", endAt: "2026-08-10T10:00:00Z", allDay: false, location: null, accountId: "team:p1" };
    assert.throws(() => saveCalendarEvent({ ...base, brandId: null, guestVisible: true }), /marka/i);
    assert.throws(() => saveCalendarEvent({ ...base, brandId: "b1", guestVisible: false, endAt: "2026-08-10T08:00:00Z" }), /bitiş/i);
  });

  it("İstanbul gününü ve tüm gün bitişinin son gün dahil kuralını korur", () => {
    const timed = normalizeCalendarFormRange("2026-08-10T00:30", "2026-08-10T01:30", false);
    assert.equal(timed.startAt, "2026-08-09T21:30:00.000Z");
    assert.equal(calendarEventStartDate({ start_at: timed.startAt, end_at: timed.endAt, all_day: 0 }), "2026-08-10");

    const allDay = normalizeCalendarFormRange("2026-08-10", "2026-08-11", true);
    assert.deepEqual(allDay, { startAt: "2026-08-10", endAt: "2026-08-12" });
    const event = { start_at: allDay.startAt, end_at: allDay.endAt, all_day: 1 };
    assert.equal(eventOccursOnDate(event, "2026-08-10"), true);
    assert.equal(eventOccursOnDate(event, "2026-08-11"), true);
    assert.equal(eventOccursOnDate(event, "2026-08-12"), false);
  });

  it("ekip takvim sayfası görev sorgusu veya görev bileşeni içermez", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app/calendar/page.tsx"), "utf8");
    assert.doesNotMatch(source, /listTasksDueInRange|TaskListView|QuickAddModal/);
    assert.match(source, />\s*Bugün\s*</);
    assert.match(source, /showToday\s*&&/);
    assert.match(source, /preservedQuery/);
    assert.match(source, /minmax\(12rem,20rem\)/);
    assert.match(source, /name="colorKey"/);

    const gridSource = fs.readFileSync(path.join(process.cwd(), "components/EventCalendarGrid.tsx"), "utf8");
    assert.match(gridSource, /günü için etkinlik oluştur/);
    assert.match(gridSource, /dayQuery\.set\("day"/);
    assert.match(gridSource, /pointer-events-auto/);
  });

  it("paylaşılan marka etkinliğini aktif guest hesabına yalnızca bir kez bildirir", () => {
    const db = seed();
    db.prepare("INSERT INTO accounts (id,kind,brand_id,username,active) VALUES ('guest:b1','guest','b1','bir-guest',1)").run();
    const eventId = saveCalendarEvent({ brandId: "b1", type: "Toplanti", title: "Aylık değerlendirme", description: null, startAt: "2026-08-18T09:00:00Z", endAt: "2026-08-18T10:00:00Z", allDay: false, location: null, guestVisible: true, accountId: "team:p1" });
    const input = { actor: { id: "p1", name: "Ada", title: null, bio: null, avatar_path: null, department: null, is_manager: 0, active: 1 }, calendarEventId: eventId, brandId: "b1", title: "Aylık değerlendirme", typeLabel: "Toplantı" };
    notifyGuestCalendarEvent(input);
    notifyGuestCalendarEvent(input);
    const notifications = listNotificationsForRecipient("guest:b1");
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].calendar_event_id, eventId);
    assert.equal(notifications[0].calendar_event_start_at, "2026-08-18T09:00:00Z");
    assert.match(notifications[0].summary, /sizinle paylaştı/);
  });

  it("eski v03 takvim tablosuna rengi veri kaybetmeden ekler", () => {
    const legacy = new DatabaseSync(TMP_DB);
    legacy.exec(`CREATE TABLE calendar_events (
      id TEXT PRIMARY KEY, brand_id TEXT, type TEXT NOT NULL DEFAULT 'Toplanti', title TEXT NOT NULL,
      description TEXT, start_at TEXT NOT NULL, end_at TEXT NOT NULL, all_day INTEGER NOT NULL DEFAULT 0,
      location TEXT, guest_visible INTEGER NOT NULL DEFAULT 0, google_event_id TEXT UNIQUE, google_etag TEXT,
      google_updated_at TEXT, sync_status TEXT NOT NULL DEFAULT 'pending', sync_error TEXT, deleted_at TEXT,
      created_by_account_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')), last_synced_at TEXT
    );
    INSERT INTO calendar_events (id, title, start_at, end_at) VALUES ('legacy-event', 'Eski', '2026-08-10', '2026-08-11');`);
    legacy.close();

    const db = getDb();
    const columns = db.prepare("PRAGMA table_info(calendar_events)").all() as Array<{ name: string }>;
    assert.ok(columns.some((column) => column.name === "color_key"));
    assert.equal((db.prepare("SELECT color_key FROM calendar_events WHERE id = 'legacy-event'").get() as { color_key: string }).color_key, "auto");
  });
});
