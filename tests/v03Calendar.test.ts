import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-v03-calendar-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;
const { getDb } = await import("@/lib/db/client");
const { applyInboundGoogleEvent, getCalendarEvent, listCalendarEvents, listGuestCalendarEvents, listPendingCalendarEvents, markCalendarEventSyncError, saveCalendarEvent, setCalendarSyncState } = await import("@/lib/repositories/calendarEvents");
const { notifyGuestCalendarEvent } = await import("@/lib/notifications");
const { listNotificationsForRecipient } = await import("@/lib/repositories/notifications");
const {
  CALENDAR_EVENT_COLORS,
  calendarEventTone,
  colorFromGoogle,
  googleColorId,
  isCalendarEventColor,
} = await import("@/lib/calendar/colors");
const { calendarWeekEventSegments } = await import("@/lib/calendar/layout");
const { calendarEventStartDate, eventOccursOnDate, eventOverlapsDateRange, normalizeCalendarFormRange } = await import("@/lib/calendar/time");
const { calendarEventToGoogleBody } = await import("@/lib/calendar/google");
const { getCalendarSyncHealth } = await import("@/lib/calendar/health");
const { clearCalendarDialogParams } = await import("@/lib/calendar/dialogUrl");

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

  it("senkron sağlığı kuyruk, hata ve scheduler heartbeat durumunu özetler", () => {
    seed();
    const pendingId = saveCalendarEvent({ brandId: "b1", type: "Toplanti", title: "Bekleyen", description: null, startAt: "2026-08-10T09:00:00Z", endAt: "2026-08-10T10:00:00Z", allDay: false, location: null, guestVisible: false, accountId: "team:p1" });
    const errorId = saveCalendarEvent({ brandId: "b1", type: "Cekim", title: "Hatalı", description: null, startAt: "2026-08-11T09:00:00Z", endAt: "2026-08-11T10:00:00Z", allDay: false, location: null, guestVisible: false, accountId: "team:p1" });
    markCalendarEventSyncError(errorId, "Google erişilemiyor");
    setCalendarSyncState("calendar_last_attempt_at", "2026-08-12T09:58:00.000Z");
    setCalendarSyncState("calendar_last_success_at", "2026-08-12T09:55:00.000Z");
    setCalendarSyncState("calendar_scheduler_last_seen_at", "2026-08-12T09:58:00.000Z");

    const health = getCalendarSyncHealth({ configured: true, now: new Date("2026-08-12T10:00:00.000Z") });
    assert.equal(health.pendingCount, 1);
    assert.equal(health.errorCount, 1);
    assert.equal(health.schedulerStatus, "active");
    assert.equal(health.overallStatus, "error");
    assert.ok(listPendingCalendarEvents().some((event) => event.id === pendingId));
  });

  it("Google ayarları yoksa sağlık durumunu açıkça yapılandırılmamış gösterir", () => {
    seed();
    const health = getCalendarSyncHealth({ configured: false, now: new Date("2026-08-12T10:00:00.000Z") });
    assert.equal(health.configured, false);
    assert.equal(health.overallStatus, "unconfigured");
    assert.equal(health.schedulerStatus, "unknown");
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

  it("otomatik seçeneğiyle birlikte Google Takvim'in 11 etkinlik rengini kayıpsız eşler", () => {
    const expectedGoogleColors = [
      ["lavender", "1"],
      ["sage", "2"],
      ["purple", "3"],
      ["coral", "4"],
      ["amber", "5"],
      ["orange", "6"],
      ["cyan", "7"],
      ["slate", "8"],
      ["blue", "9"],
      ["green", "10"],
      ["rose", "11"],
    ] as const;

    assert.equal(CALENDAR_EVENT_COLORS.length, 12);
    assert.equal(googleColorId("auto"), undefined);
    assert.equal(colorFromGoogle(undefined), "auto");
    for (const [color, googleId] of expectedGoogleColors) {
      assert.equal(isCalendarEventColor(color), true);
      assert.equal(googleColorId(color), googleId);
      assert.equal(colorFromGoogle(googleId), color);
    }
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

  it("ay sayaçlarında komşu ay günlerini dışarıda bırakıp aya taşan etkinliği korur", () => {
    const augustStart = "2026-08-01";
    const septemberStart = "2026-09-01";
    assert.equal(eventOverlapsDateRange(
      { start_at: "2026-07-31", end_at: "2026-08-02", all_day: 1 },
      augustStart,
      septemberStart,
    ), true);
    assert.equal(eventOverlapsDateRange(
      { start_at: "2026-07-27", end_at: "2026-07-28", all_day: 1 },
      augustStart,
      septemberStart,
    ), false);
    assert.equal(eventOverlapsDateRange(
      { start_at: "2026-09-01", end_at: "2026-09-02", all_day: 1 },
      augustStart,
      septemberStart,
    ), false);
  });

  it("çok günlük etkinliği haftada tek ve kesintisiz bir segmente dönüştürür", () => {
    const week = Array.from({ length: 7 }, (_, index) => ({
      date: `2026-08-${String(index + 3).padStart(2, "0")}`,
      inMonth: true,
    }));
    const event = {
      id: "multi", brand_id: "b1", type: "Cekim", color_key: "rose", title: "Üç günlük çekim",
      description: null, start_at: "2026-08-04", end_at: "2026-08-07", all_day: 1,
      location: null, guest_visible: 0, google_event_id: null, google_etag: null,
      google_updated_at: null, sync_status: "pending", sync_error: null, deleted_at: null,
      created_by_account_id: null, created_at: "", updated_at: "", last_synced_at: null,
    } as const;

    const segments = calendarWeekEventSegments([event], week);
    assert.equal(segments.length, 1);
    assert.deepEqual(
      { startColumn: segments[0].startColumn, span: segments[0].span, lane: segments[0].lane },
      { startColumn: 2, span: 3, lane: 0 },
    );
  });

  it("hafta sınırını aşan etkinliği aynı şeritte devam işaretleriyle böler", () => {
    const firstWeek = Array.from({ length: 7 }, (_, index) => ({ date: `2026-08-${String(index + 3).padStart(2, "0")}`, inMonth: true }));
    const secondWeek = Array.from({ length: 7 }, (_, index) => ({ date: `2026-08-${String(index + 10).padStart(2, "0")}`, inMonth: true }));
    const event = {
      id: "cross-week", brand_id: null, type: "Toplanti", color_key: "blue", title: "Uzun toplantı",
      description: null, start_at: "2026-08-08", end_at: "2026-08-13", all_day: 1,
      location: null, guest_visible: 0, google_event_id: null, google_etag: null,
      google_updated_at: null, sync_status: "pending", sync_error: null, deleted_at: null,
      created_by_account_id: null, created_at: "", updated_at: "", last_synced_at: null,
    } as const;

    const first = calendarWeekEventSegments([event], firstWeek)[0];
    const second = calendarWeekEventSegments([event], secondWeek)[0];
    assert.deepEqual({ startColumn: first.startColumn, span: first.span, continuesAfter: first.continuesAfter }, { startColumn: 6, span: 2, continuesAfter: true });
    assert.deepEqual({ startColumn: second.startColumn, span: second.span, continuesBefore: second.continuesBefore }, { startColumn: 1, span: 3, continuesBefore: true });
  });

  it("ekip takvim sayfası görev sorgusu veya görev bileşeni içermez", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app/calendar/page.tsx"), "utf8");
    assert.doesNotMatch(source, /listTasksDueInRange|TaskListView|QuickAddModal/);
    assert.match(source, />\s*Bugün\s*</);
    assert.match(source, /showToday\s*&&/);
    assert.match(source, /preservedQuery/);
    assert.match(source, /CalendarFilterBar/);
    assert.match(source, /matchesCalendarQuery\(/);
    assert.match(source, /CalendarEventDialog/);
    assert.match(source, /CalendarMonthAgenda/);
    assert.match(source, /<MonthNavigator/);
    assert.doesNotMatch(source, /CalendarBrandVisibilityFields/);
    assert.match(source, /me\.is_manager === 1/);
    assert.match(source, /CalendarSyncHealthCard/);

    const gridSource = fs.readFileSync(path.join(process.cwd(), "components/EventCalendarGrid.tsx"), "utf8");
    assert.match(gridSource, /günü için etkinlik oluştur/);
    assert.match(gridSource, /dayQuery\.set\("day"/);
    assert.match(gridSource, /pointer-events-auto/);
    assert.match(gridSource, /calendarWeekEventSegments/);
    const dateFieldsSource = fs.readFileSync(path.join(process.cwd(), "components/CalendarDateTimeFields.tsx"), "utf8");
    assert.match(dateFieldsSource, /Tüm gün[\s\S]*Guest ile paylaş/);
    assert.match(dateFieldsSource, /<fieldset[\s\S]*data-calendar-section="timing"/);
    assert.match(dateFieldsSource, /<legend[\s\S]*Zamanlama/);
    assert.match(dateFieldsSource, /data-calendar-datetime-layout="paired"/);
    assert.match(dateFieldsSource, /<Input/);
    assert.match(dateFieldsSource, /<Select/);

    const dialogSource = fs.readFileSync(path.join(process.cwd(), "components/CalendarEventDialog.tsx"), "utf8");
    assert.match(dialogSource, /createPortal/);
    assert.match(dialogSource, /role="dialog"/);
    assert.match(dialogSource, /aria-modal="true"/);
    assert.match(dialogSource, /event\.key !== "Tab"/);
    assert.match(dialogSource, /document\.body\.style\.overflow = "hidden"/);
    assert.match(dialogSource, /window\.history\.replaceState/);
    assert.match(dialogSource, /saveCalendarEventAction/);
    assert.match(dialogSource, /cancelCalendarEventAction/);
    const colorPickerSource = fs.readFileSync(path.join(process.cwd(), "components/CalendarColorPicker.tsx"), "utf8");
    assert.match(colorPickerSource, /"use client"/);
    assert.match(colorPickerSource, /<select[\s\S]*name="colorKey"[\s\S]*defaultValue=\{selected\}/);
    assert.match(colorPickerSource, /data-calendar-color-trigger/);
    assert.match(colorPickerSource, /aria-haspopup="listbox"/);
    assert.match(colorPickerSource, /aria-expanded=\{open\}/);
    assert.match(colorPickerSource, /data-calendar-color-palette/);
    assert.match(colorPickerSource, /role="listbox"/);
    assert.match(colorPickerSource, /role="option"/);
    assert.match(colorPickerSource, /aria-selected=\{selected === color\.key\}/);
    assert.match(colorPickerSource, /title=\{color\.label\}/);
    assert.match(colorPickerSource, /addEventListener\("pointerdown"/);
    assert.match(colorPickerSource, /event\.key !== "Escape"/);
    assert.match(colorPickerSource, /dotClass/);
  });

  it("modal kapanırken takvim filtrelerini koruyup yalnız modal parametrelerini temizler", () => {
    const result = clearCalendarDialogParams(
      new URL("http://tracker.local/calendar?month=2026-08&brand=b1&type=Cekim&q=lansman&event=e1&day=2026-08-12#takvim"),
    );
    assert.equal(
      result,
      "/calendar?month=2026-08&brand=b1&type=Cekim&q=lansman#takvim",
    );
  });

  it("beş dakikalık görev scheduled kaynağını ve gizli runner'ı kullanır", () => {
    const syncSource = fs.readFileSync(path.join(process.cwd(), "db/sync-calendar.mts"), "utf8");
    const installerSource = fs.readFileSync(path.join(process.cwd(), "scripts/install-calendar-sync-task.ps1"), "utf8");
    const runnerSource = fs.readFileSync(path.join(process.cwd(), "scripts/run-calendar-sync.ps1"), "utf8");
    assert.match(syncSource, /--scheduled/);
    assert.match(syncSource, /runCalendarSync\(source\)/);
    assert.match(installerSource, /\.env\.local/);
    assert.match(installerSource, /GOOGLE_CALENDAR_ID/);
    assert.match(installerSource, /run-calendar-sync\.ps1/);
    assert.match(installerSource, /New-TimeSpan -Minutes 5/);
    assert.match(runnerSource, /calendar:sync -- --scheduled/);
  });

  it("paylaşılan marka etkinliğini aktif guest hesabına yalnızca bir kez bildirir", () => {
    const db = seed();
    db.prepare("INSERT INTO accounts (id,kind,brand_id,username,active) VALUES ('guest:b1','guest','b1','bir-guest',1)").run();
    const eventId = saveCalendarEvent({ brandId: "b1", type: "Toplanti", title: "Aylık değerlendirme", description: null, startAt: "2026-08-18T09:00:00Z", endAt: "2026-08-18T10:00:00Z", allDay: false, location: null, guestVisible: true, accountId: "team:p1" });
    const input = { actor: { id: "p1", username: "p1", name: "Ada", title: null, bio: null, avatar_path: null, department: null, is_manager: 0, active: 1 }, calendarEventId: eventId, brandId: "b1", title: "Aylık değerlendirme", typeLabel: "Toplantı" };
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

  it("eski sekizli renk kısıtını Google Takvim'in tam paletine veri kaybetmeden genişletir", () => {
    const legacy = new DatabaseSync(TMP_DB);
    legacy.exec(`CREATE TABLE calendar_events (
      id TEXT PRIMARY KEY, brand_id TEXT, type TEXT NOT NULL DEFAULT 'Toplanti',
      color_key TEXT NOT NULL DEFAULT 'auto'
        CHECK (color_key IN ('auto','purple','blue','cyan','green','amber','rose','slate')),
      title TEXT NOT NULL, description TEXT, start_at TEXT NOT NULL, end_at TEXT NOT NULL,
      all_day INTEGER NOT NULL DEFAULT 0, location TEXT, guest_visible INTEGER NOT NULL DEFAULT 0,
      google_event_id TEXT UNIQUE, google_etag TEXT, google_updated_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending', sync_error TEXT, deleted_at TEXT,
      created_by_account_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')), last_synced_at TEXT
    );
    INSERT INTO calendar_events (id, color_key, title, start_at, end_at)
    VALUES ('legacy-purple', 'purple', 'Korunacak', '2026-08-10', '2026-08-11');`);
    legacy.close();

    const db = getDb();
    db.prepare(`INSERT INTO calendar_events (id, color_key, title, start_at, end_at)
      VALUES ('new-lavender', 'lavender', 'Yeni renk', '2026-08-12', '2026-08-13')`).run();
    assert.equal((db.prepare("SELECT color_key FROM calendar_events WHERE id = 'legacy-purple'").get() as { color_key: string }).color_key, "purple");
    assert.equal((db.prepare("SELECT color_key FROM calendar_events WHERE id = 'new-lavender'").get() as { color_key: string }).color_key, "lavender");
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  });
});
