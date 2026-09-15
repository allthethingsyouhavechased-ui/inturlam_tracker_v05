// Günlük mesai. Sunucu zamanı esas; net süre çalışma aralığından molalar
// çıkarılarak bulunur; gece yarısını aşan süre İstanbul takvimine göre iki
// güne bölünür. Kişi başına TEK açık çalışma ve TEK açık mola.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

import fsSync from "node:fs";
import pathSync from "node:path";
import {
  BREAK_ALERT_MINUTES,
  breakLimitExceeded,
  formatMinutes,
  isStaleOpenSession,
  istanbulDayOf,
  netMinutes,
  splitByIstanbulDay,
} from "@/lib/worklog";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-worklog-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");
const {
  decideWorkCorrection,
  endBreak,
  endWorkSession,
  getOpenWorkSession,
  listTeamWorkSummary,
  listWorkCorrections,
  listWorkSessions,
  requestWorkCorrection,
  startBreak,
  startWorkSession,
  workStateFor,
} = await import("@/lib/repositories/worklog");

function resetDb(): void {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(TMP_DB + suffix, { force: true });
}

function seed(): void {
  const db = getDb();
  db.prepare("INSERT INTO people (id,name,is_manager) VALUES ('mgr','Yönetici',1)").run();
  db.prepare("INSERT INTO people (id,name) VALUES ('ada','Ada')").run();
}

beforeEach(() => { resetDb(); seed(); });
after(resetDb);

const ms = (stamp: string) => Date.parse(stamp);

describe("süre hesabı", () => {
  it("net süre = çalışma - molalar", () => {
    const work = { start: "2026-09-15T06:00:00Z", end: "2026-09-15T15:00:00Z" };
    const breaks = [{ start: "2026-09-15T09:00:00Z", end: "2026-09-15T10:00:00Z" }];
    assert.equal(netMinutes(work, breaks, ms("2026-09-15T15:00:00Z")), 8 * 60);
  });

  it("açık mola şimdiye kadar düşülüyor", () => {
    const work = { start: "2026-09-15T06:00:00Z", end: null };
    const breaks = [{ start: "2026-09-15T09:00:00Z", end: null }];
    assert.equal(netMinutes(work, breaks, ms("2026-09-15T10:00:00Z")), 3 * 60);
  });

  it("çalışma aralığı dışına taşan mola net süreyi negatife çekmiyor", () => {
    const work = { start: "2026-09-15T06:00:00Z", end: "2026-09-15T07:00:00Z" };
    const breaks = [{ start: "2026-09-15T05:00:00Z", end: "2026-09-15T09:00:00Z" }];
    assert.equal(netMinutes(work, breaks, ms("2026-09-15T09:00:00Z")), 0);
  });

  it("dakika biçimi saat ve dakikayı ayırıyor", () => {
    assert.equal(formatMinutes(45), "45 dk");
    assert.equal(formatMinutes(8 * 60 + 5), "8 sa 05 dk");
  });
});

describe("İstanbul takvimi", () => {
  it("UTC 21:30 ertesi günün İstanbul gününe düşüyor", () => {
    assert.equal(istanbulDayOf("2026-09-15T21:30:00Z"), "2026-09-16");
    assert.equal(istanbulDayOf("2026-09-15T20:30:00Z"), "2026-09-15");
  });

  it("gece yarısını aşan mesai iki güne bölünüyor", () => {
    // 15 Eylül 23:00 TSİ (20:00Z) → 16 Eylül 02:00 TSİ (23:00Z)
    const slices = splitByIstanbulDay(
      { start: "2026-09-15T20:00:00Z", end: "2026-09-15T23:00:00Z" },
      [],
      ms("2026-09-15T23:00:00Z"),
    );
    assert.deepEqual(slices, [
      { day: "2026-09-15", minutes: 60 },
      { day: "2026-09-16", minutes: 120 },
    ]);
  });

  it("tek güne sığan mesai tek dilim üretiyor", () => {
    const slices = splitByIstanbulDay(
      { start: "2026-09-15T06:00:00Z", end: "2026-09-15T15:00:00Z" },
      [],
      ms("2026-09-15T15:00:00Z"),
    );
    assert.deepEqual(slices, [{ day: "2026-09-15", minutes: 540 }]);
  });
});

describe("mesai kaydı", () => {
  it("kişi başına tek açık çalışma: ikinci başlatma reddediliyor", () => {
    startWorkSession("ada");
    assert.throws(() => startWorkSession("ada"), /Zaten açık bir mesai/);
    assert.equal(listWorkSessions("ada").length, 1);
  });

  it("oturum başına tek açık mola", () => {
    startWorkSession("ada");
    startBreak("ada");
    assert.throws(() => startBreak("ada"), /Zaten moladasın/);
  });

  it("durumlar sırayla ilerliyor", () => {
    assert.equal(workStateFor(getOpenWorkSession("ada")), "calismiyor");
    startWorkSession("ada");
    assert.equal(workStateFor(getOpenWorkSession("ada")), "calisiyor");
    startBreak("ada");
    assert.equal(workStateFor(getOpenWorkSession("ada")), "molada");
    endBreak("ada");
    assert.equal(workStateFor(getOpenWorkSession("ada")), "calisiyor");
    endWorkSession("ada");
    assert.equal(getOpenWorkSession("ada"), undefined);
    assert.equal(workStateFor(listWorkSessions("ada")[0]), "tamamlandi");
  });

  it("moladayken günü bitirmek açık molayı da kapatıyor", () => {
    startWorkSession("ada");
    startBreak("ada");
    endWorkSession("ada");
    const session = listWorkSessions("ada")[0];
    assert.ok(session.ended_at);
    assert.equal(session.breaks.filter((item) => item.ended_at === null).length, 0);
  });

  it("mesai başlatmadan mola açılamıyor", () => {
    assert.throws(() => startBreak("ada"), /Önce mesaiyi başlat/);
    assert.throws(() => endBreak("ada"), /Açık bir mola yok/);
  });

  it("uzun süre açık kalan kayıt uyarı üretiyor ama otomatik kapanmıyor", () => {
    const now = ms("2026-09-16T12:00:00Z");
    assert.equal(isStaleOpenSession("2026-09-15T06:00:00Z", now), true);
    assert.equal(isStaleOpenSession("2026-09-16T06:00:00Z", now), false);
    startWorkSession("ada");
    // Kayıt hâlâ açık: sistem saat uydurup kapatmıyor.
    assert.ok(getOpenWorkSession("ada"));
  });
});

describe("gerekçeli düzeltme", () => {
  it("gerekçesiz veya saatsiz istek reddediliyor", () => {
    const sessionId = startWorkSession("ada");
    endWorkSession("ada");
    assert.throws(
      () => requestWorkCorrection({ sessionId, personId: "ada", reason: "  ", proposedStartedAt: "2026-09-15T06:00:00Z", proposedEndedAt: null }),
      /gerekçe zorunlu/,
    );
    assert.throws(
      () => requestWorkCorrection({ sessionId, personId: "ada", reason: "Unuttum", proposedStartedAt: null, proposedEndedAt: null }),
      /En az bir saat/,
    );
  });

  it("onay eski ve yeni değerleri birlikte koruyor", () => {
    const sessionId = startWorkSession("ada");
    endWorkSession("ada");
    const before = listWorkSessions("ada")[0];
    const correctionId = requestWorkCorrection({
      sessionId,
      personId: "ada",
      reason: "Günü kapatmayı unuttum",
      proposedStartedAt: "2026-09-15T06:00:00Z",
      proposedEndedAt: "2026-09-15T15:00:00Z",
    });
    decideWorkCorrection({ correctionId, approve: true, decidedBy: "mgr", note: "Kabul" });

    const after = listWorkSessions("ada")[0];
    assert.equal(after.started_at, "2026-09-15T06:00:00Z");
    assert.equal(after.ended_at, "2026-09-15T15:00:00Z");
    const record = listWorkCorrections()[0];
    assert.equal(record.status, "Onaylandi");
    assert.equal(record.previous_started_at, before.started_at);
    assert.equal(record.previous_ended_at, before.ended_at);
  });

  it("reddedilen istek kaydı değiştirmiyor", () => {
    const sessionId = startWorkSession("ada");
    endWorkSession("ada");
    const before = listWorkSessions("ada")[0];
    const correctionId = requestWorkCorrection({
      sessionId, personId: "ada", reason: "Deneme",
      proposedStartedAt: "2020-01-01T06:00:00Z", proposedEndedAt: null,
    });
    decideWorkCorrection({ correctionId, approve: false, decidedBy: "mgr", note: null });
    assert.equal(listWorkSessions("ada")[0].started_at, before.started_at);
    assert.equal(listWorkCorrections()[0].status, "Reddedildi");
  });

  it("karara bağlanmış istek ikinci kez karara bağlanamıyor", () => {
    const sessionId = startWorkSession("ada");
    endWorkSession("ada");
    const correctionId = requestWorkCorrection({
      sessionId, personId: "ada", reason: "Deneme",
      proposedStartedAt: "2026-09-15T06:00:00Z", proposedEndedAt: null,
    });
    decideWorkCorrection({ correctionId, approve: true, decidedBy: "mgr", note: null });
    assert.throws(
      () => decideWorkCorrection({ correctionId, approve: false, decidedBy: "mgr", note: null }),
      /zaten karara bağlanmış/,
    );
  });
});

describe("ekip özeti", () => {
  it("gece yarısını aşan kaydı iki güne dağıtıp gün gün sayıyor", () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO work_sessions (id, person_id, started_at, ended_at)
       VALUES ('s1','ada','2026-09-15T20:00:00Z','2026-09-15T23:00:00Z')`,
    ).run();
    const now = ms("2026-09-16T12:00:00Z");
    const first = listTeamWorkSummary("2026-09-15", "2026-09-15", now)
      .find((row) => row.person_id === "ada")!;
    const second = listTeamWorkSummary("2026-09-16", "2026-09-16", now)
      .find((row) => row.person_id === "ada")!;
    assert.equal(first.net_minutes, 60);
    assert.equal(second.net_minutes, 120);
    // İki günün toplamı, kaydın tamamına eşit — süre kaybolmuyor/çiftlenmiyor.
    assert.equal(first.net_minutes + second.net_minutes, 180);
  });

  it("kaydı olmayan kişi sıfır ile listede kalıyor", () => {
    const summary = listTeamWorkSummary("2026-09-15", "2026-09-15", ms("2026-09-15T12:00:00Z"));
    assert.deepEqual(
      summary.map((row) => [row.person_id, row.net_minutes]).sort(),
      [["ada", 0], ["mgr", 0]],
    );
  });
});

describe("uzun mola uyarısı", () => {
  it("eşik TOPLAM molaya bakıyor, tek tek molalara değil", () => {
    assert.equal(BREAK_ALERT_MINUTES, 60);
    assert.equal(breakLimitExceeded(60), false, "tam eşik henüz aşılmış sayılmaz");
    assert.equal(breakLimitExceeded(61), true);
    // Üç kez 25 dakika = 75 dakika: tek mola kısa olsa da toplam eşiği aşar.
    assert.equal(breakLimitExceeded(25 * 3), true);
  });

  it("toplam mola eşiği aşılınca kişiye BİR KEZ bildirim yazılıyor", () => {
    const db = getDb();
    const sessionId = startWorkSession("ada");
    // 70 dakikalık kapanmış mola: eşik aşıldı.
    db.prepare(
      `INSERT INTO work_breaks (id, session_id, started_at, ended_at)
       VALUES ('b1', ?, '2026-09-15T06:00:00Z', '2026-09-15T07:10:00Z')`,
    ).run(sessionId);

    const view = getOpenWorkSession("ada", ms("2026-09-15T08:00:00Z"))!;
    assert.equal(view.break_limit_exceeded, true);
    const first = db.prepare("SELECT COUNT(*) c FROM notifications WHERE recipient_id = 'ada'").get() as { c: number };
    assert.equal(first.c, 1, "eşik aşılınca bildirim yazılmalı");

    // İkinci okuma yeni bildirim ÜRETMEZ (damga).
    getOpenWorkSession("ada", ms("2026-09-15T09:00:00Z"));
    const second = db.prepare("SELECT COUNT(*) c FROM notifications WHERE recipient_id = 'ada'").get() as { c: number };
    assert.equal(second.c, 1, "damga ikinci bildirimi engellemeli");
  });

  it("eşik aşılmadıkça bildirim yazılmıyor", () => {
    const db = getDb();
    const sessionId = startWorkSession("ada");
    db.prepare(
      `INSERT INTO work_breaks (id, session_id, started_at, ended_at)
       VALUES ('b1', ?, '2026-09-15T06:00:00Z', '2026-09-15T06:30:00Z')`,
    ).run(sessionId);
    const view = getOpenWorkSession("ada", ms("2026-09-15T08:00:00Z"))!;
    assert.equal(view.break_limit_exceeded, false);
    assert.equal((db.prepare("SELECT COUNT(*) c FROM notifications").get() as { c: number }).c, 0);
  });

  it("kapanmış günde uyarı üretilmiyor", () => {
    const db = getDb();
    const sessionId = startWorkSession("ada");
    db.prepare(
      `INSERT INTO work_breaks (id, session_id, started_at, ended_at)
       VALUES ('b1', ?, '2026-09-15T06:00:00Z', '2026-09-15T07:10:00Z')`,
    ).run(sessionId);
    endWorkSession("ada");
    assert.equal(getOpenWorkSession("ada"), undefined);
    assert.equal((db.prepare("SELECT COUNT(*) c FROM notifications").get() as { c: number }).c, 0);
  });
});

describe("mesai görünürlüğü", () => {
  const page = fsSync.readFileSync(pathSync.join(process.cwd(), "app/mesai/page.tsx"), "utf8");

  it("kişi YALNIZCA kendi kayıtlarını okuyor", () => {
    assert.match(page, /getOpenWorkSession\(me\.id/);
    assert.match(page, /listWorkSessions\(me\.id/);
    // Başka bir kişinin id'siyle okuma yok.
    assert.doesNotMatch(page, /listWorkSessions\((?!me\.id)/);
  });

  it("ekip özeti ve düzeltme kuyruğu yalnız yöneticide", () => {
    assert.match(page, /me\.is_manager === 1 \? listTeamWorkSummary/);
    assert.match(page, /me\.is_manager === 1 \? listWorkCorrections/);
  });
});
