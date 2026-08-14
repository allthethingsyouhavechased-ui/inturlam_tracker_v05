import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-event-reports-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");
const {
  getReportableCalendarEvent,
  listBrandCalendarEventReports,
  saveCalendarEventReport,
} = await import("@/lib/repositories/calendarEventReports");

function resetDb() {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(TMP_DB + suffix, { force: true });
}

function seed() {
  const db = getDb();
  db.prepare("INSERT INTO brands (id,name,cluster) VALUES ('b1','Marka Bir','tek')").run();
  db.prepare("INSERT INTO people (id,name) VALUES ('p1','Ada')").run();
  db.prepare(
    `INSERT INTO calendar_events (id,brand_id,type,title,start_at,end_at,all_day)
     VALUES
       ('meeting','b1','Toplanti','Aylık toplantı','2026-08-12T10:00:00.000Z','2026-08-12T11:00:00.000Z',0),
       ('shoot','b1','Cekim','Ürün çekimi','2026-08-18T07:00:00.000Z','2026-08-18T15:00:00.000Z',0),
       ('other','b1','Diger','Hatırlatma','2026-08-20T07:00:00.000Z','2026-08-20T08:00:00.000Z',0)`,
  ).run();
  return db;
}

beforeEach(resetDb);
after(resetDb);

describe("takvim etkinlik raporları", () => {
  it("yalnızca markalı toplantı ve çekimleri raporlanabilir kabul eder", () => {
    seed();
    assert.equal(getReportableCalendarEvent("meeting")?.type, "Toplanti");
    assert.equal(getReportableCalendarEvent("shoot")?.type, "Cekim");
    assert.equal(getReportableCalendarEvent("other"), undefined);
  });

  it("raporu etkinliğe tekil bağlar, günceller ve tüm alanlar boşsa temizler", () => {
    const db = seed();
    assert.equal(saveCalendarEventReport({
      eventId: "meeting",
      participants: "Ada, Bora",
      summary: "Aylık plan görüşüldü.",
      decisions: "Çekim tarihi netleşti.",
      nextSteps: "Brief hazırlanacak.",
      updatedById: "p1",
    }), "saved");
    assert.equal(saveCalendarEventReport({
      eventId: "meeting",
      participants: "Ada",
      summary: "Özet güncellendi.",
      decisions: null,
      nextSteps: null,
      updatedById: "p1",
    }), "saved");
    assert.equal((db.prepare("SELECT COUNT(*) AS count FROM calendar_event_reports").get() as { count: number }).count, 1);
    const rows = listBrandCalendarEventReports({ brandId: "b1", rangeStart: "2026-08-01", rangeEnd: "2026-09-01" });
    assert.equal(rows.length, 2);
    assert.equal(rows.find((row) => row.event_id === "meeting")?.summary, "Özet güncellendi.");
    assert.equal(rows.find((row) => row.event_id === "meeting")?.updated_by_name, "Ada");

    assert.equal(saveCalendarEventReport({ eventId: "meeting", participants: null, summary: null, decisions: null, nextSteps: null, updatedById: "p1" }), "cleared");
    assert.equal((db.prepare("SELECT COUNT(*) AS count FROM calendar_event_reports").get() as { count: number }).count, 0);
  });

  it("etkinlik silinince raporu FK ile siler ve guest takvim sorgusuna rapor alanı eklemez", async () => {
    const db = seed();
    saveCalendarEventReport({ eventId: "shoot", participants: null, summary: "Çekim tamamlandı.", decisions: null, nextSteps: null, updatedById: "p1" });
    db.prepare("DELETE FROM calendar_events WHERE id = 'shoot'").run();
    assert.equal((db.prepare("SELECT COUNT(*) AS count FROM calendar_event_reports").get() as { count: number }).count, 0);

    const source = fs.readFileSync(path.join(process.cwd(), "lib", "repositories", "calendarEvents.ts"), "utf8");
    const guestFunction = source.match(/export function listGuestCalendarEvents[\s\S]*?\n}\n/)?.[0] ?? "";
    assert.doesNotMatch(guestFunction, /calendar_event_reports|participants|next_steps/);
    assert.match(fs.readFileSync(path.join(process.cwd(), "app", "brands", "[brandId]", "reports", "page.tsx"), "utf8"), /requirePageSession/);
  });
});
