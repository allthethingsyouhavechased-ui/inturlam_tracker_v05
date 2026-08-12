import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-v03-calendar-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;
const { getDb } = await import("@/lib/db/client");
const { applyInboundGoogleEvent, listCalendarEvents, listGuestCalendarEvents, listPendingCalendarEvents, markCalendarEventSyncError, saveCalendarEvent } = await import("@/lib/repositories/calendarEvents");
const { notifyGuestCalendarEvent } = await import("@/lib/notifications");
const { listNotificationsForRecipient } = await import("@/lib/repositories/notifications");

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

  it("ekip takvim sayfası görev sorgusu veya görev bileşeni içermez", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app/calendar/page.tsx"), "utf8");
    assert.doesNotMatch(source, /listTasksDueInRange|TaskListView|QuickAddModal/);
    assert.match(source, />\s*Bugün\s*</);
    assert.match(source, /showToday\s*&&/);
    assert.match(source, /preservedQuery/);
    assert.match(source, /minmax\(12rem,20rem\)/);

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
});
