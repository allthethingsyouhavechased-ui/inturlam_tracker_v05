import { getDb, plainList, plainOne } from "@/lib/db/client";
import {
  intervalMinutes,
  isStaleOpenSession,
  netMinutes,
  parseStamp,
  splitByIstanbulDay,
  type Interval,
  type WorkState,
} from "@/lib/worklog";

export interface WorkSessionRow {
  id: string;
  person_id: string;
  started_at: string;
  ended_at: string | null;
  note: string | null;
}

export interface WorkBreakRow {
  id: string;
  session_id: string;
  started_at: string;
  ended_at: string | null;
}

export interface WorkSessionView extends WorkSessionRow {
  breaks: WorkBreakRow[];
  net_minutes: number;
  break_minutes: number;
  /** Gece yarısını aşan mesai iki güne bölünmüş hâliyle. */
  day_slices: { day: string; minutes: number }[];
  stale: boolean;
}

function toInterval(row: { started_at: string; ended_at: string | null }): Interval {
  return { start: row.started_at, end: row.ended_at };
}

function hydrate(sessions: WorkSessionRow[], now: number): WorkSessionView[] {
  if (sessions.length === 0) return [];
  const placeholders = sessions.map(() => "?").join(", ");
  const breaks = plainList<WorkBreakRow>(
    getDb()
      .prepare(`SELECT * FROM work_breaks WHERE session_id IN (${placeholders}) ORDER BY started_at`)
      .all(...sessions.map((session) => session.id)),
  );
  const bySession = new Map<string, WorkBreakRow[]>();
  for (const row of breaks) {
    bySession.set(row.session_id, [...(bySession.get(row.session_id) ?? []), row]);
  }
  return sessions.map((session) => {
    const sessionBreaks = bySession.get(session.id) ?? [];
    const intervals = sessionBreaks.map(toInterval);
    return {
      ...session,
      breaks: sessionBreaks,
      net_minutes: netMinutes(toInterval(session), intervals, now),
      break_minutes: intervals.reduce((sum, item) => sum + intervalMinutes(item, now), 0),
      day_slices: splitByIstanbulDay(toInterval(session), intervals, now),
      stale: session.ended_at === null && isStaleOpenSession(session.started_at, now),
    };
  });
}

export function getOpenWorkSession(personId: string, now = Date.now()): WorkSessionView | undefined {
  const session = plainOne<WorkSessionRow>(
    getDb()
      .prepare("SELECT * FROM work_sessions WHERE person_id = ? AND ended_at IS NULL")
      .get(personId),
  );
  return session ? hydrate([session], now)[0] : undefined;
}

export function listWorkSessions(personId: string, limit = 30, now = Date.now()): WorkSessionView[] {
  const sessions = plainList<WorkSessionRow>(
    getDb()
      .prepare("SELECT * FROM work_sessions WHERE person_id = ? ORDER BY started_at DESC LIMIT ?")
      .all(personId, limit),
  );
  return hydrate(sessions, now);
}

export function workStateFor(session: WorkSessionView | undefined): WorkState {
  if (!session) return "calismiyor";
  if (session.ended_at) return "tamamlandi";
  return session.breaks.some((item) => item.ended_at === null) ? "molada" : "calisiyor";
}

/**
 * Mesaiyi başlatır. Kişi başına TEK açık kayıt: çift tıklama ya da ikinci
 * sekme ikinci kayıt açamaz (kısmi UNIQUE indeks + burada erken kontrol).
 * Zaman SUNUCUDAN alınır; istemcinin gönderdiği saate güvenilmez.
 */
export function startWorkSession(personId: string): string {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const open = db
      .prepare("SELECT id FROM work_sessions WHERE person_id = ? AND ended_at IS NULL")
      .get(personId) as { id: string } | undefined;
    if (open) throw new Error("Zaten açık bir mesai kaydın var.");
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO work_sessions (id, person_id, started_at)
       VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now'))`,
    ).run(id, personId);
    db.exec("COMMIT");
    return id;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function startBreak(personId: string): string {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const session = db
      .prepare("SELECT id FROM work_sessions WHERE person_id = ? AND ended_at IS NULL")
      .get(personId) as { id: string } | undefined;
    if (!session) throw new Error("Önce mesaiyi başlat.");
    if (db.prepare("SELECT 1 FROM work_breaks WHERE session_id = ? AND ended_at IS NULL").get(session.id)) {
      throw new Error("Zaten moladasın.");
    }
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO work_breaks (id, session_id, started_at)
       VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now'))`,
    ).run(id, session.id);
    db.exec("COMMIT");
    return id;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function endBreak(personId: string): void {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = db
      .prepare(
        `UPDATE work_breaks SET ended_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
          WHERE ended_at IS NULL
            AND session_id IN (SELECT id FROM work_sessions WHERE person_id = ? AND ended_at IS NULL)`,
      )
      .run(personId);
    if (Number(result.changes) === 0) throw new Error("Açık bir mola yok.");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Günü bitirir. MOLADAYKEN bitirmek açık molayı da AYNI anda kapatır —
 * aksi hâlde net süre, hiç bitmeyen bir molayla sonsuza kadar eksilirdi.
 */
export function endWorkSession(personId: string, note: string | null = null): void {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const session = db
      .prepare("SELECT id FROM work_sessions WHERE person_id = ? AND ended_at IS NULL")
      .get(personId) as { id: string } | undefined;
    if (!session) throw new Error("Açık bir mesai kaydın yok.");
    db.prepare(
      `UPDATE work_breaks SET ended_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
        WHERE session_id = ? AND ended_at IS NULL`,
    ).run(session.id);
    db.prepare(
      `UPDATE work_sessions
          SET ended_at = strftime('%Y-%m-%dT%H:%M:%SZ','now'), note = COALESCE(?, note),
              updated_at = datetime('now')
        WHERE id = ?`,
    ).run(note, session.id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

// ————— Yönetici özeti —————

export interface TeamWorkSummaryRow {
  person_id: string;
  person_name: string;
  net_minutes: number;
  session_count: number;
  open_session: boolean;
}

/**
 * Ekip özeti: verilen İstanbul gün aralığındaki net süre. Gece yarısını aşan
 * kayıtlar gün gün dağıtılarak sayılır, tek güne yığılmaz.
 */
export function listTeamWorkSummary(
  startDay: string,
  endDay: string,
  now = Date.now(),
): TeamWorkSummaryRow[] {
  const db = getDb();
  const people = plainList<{ id: string; name: string }>(
    db.prepare("SELECT id, name FROM people WHERE active = 1 ORDER BY name").all(),
  );
  // Aralığın iki ucundan taşan kayıtlar da gerekiyor (gece yarısı bölünmesi):
  // bu yüzden filtre SQL'de geniş tutulup dağıtım JS'te yapılıyor.
  const sessions = plainList<WorkSessionRow>(
    db
      .prepare(
        `SELECT * FROM work_sessions
          WHERE date(started_at) BETWEEN date(?, '-1 day') AND date(?, '+1 day')
          ORDER BY started_at`,
      )
      .all(startDay, endDay),
  );
  const views = hydrate(sessions, now);
  const byPerson = new Map<string, { minutes: number; sessions: number; open: boolean }>();
  for (const view of views) {
    const inRange = view.day_slices.filter((slice) => slice.day >= startDay && slice.day <= endDay);
    if (inRange.length === 0) continue;
    const current = byPerson.get(view.person_id) ?? { minutes: 0, sessions: 0, open: false };
    current.minutes += inRange.reduce((sum, slice) => sum + slice.minutes, 0);
    current.sessions += 1;
    current.open = current.open || view.ended_at === null;
    byPerson.set(view.person_id, current);
  }
  return people.map((person) => ({
    person_id: person.id,
    person_name: person.name,
    net_minutes: byPerson.get(person.id)?.minutes ?? 0,
    session_count: byPerson.get(person.id)?.sessions ?? 0,
    open_session: byPerson.get(person.id)?.open ?? false,
  }));
}

// ————— Gerekçeli düzeltme —————

export interface WorkCorrectionRow {
  id: string;
  session_id: string;
  requested_by: string;
  requested_by_name: string | null;
  reason: string;
  proposed_started_at: string | null;
  proposed_ended_at: string | null;
  previous_started_at: string | null;
  previous_ended_at: string | null;
  status: "Beklemede" | "Onaylandi" | "Reddedildi";
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
}

export function listWorkCorrections(status?: "Beklemede"): WorkCorrectionRow[] {
  const db = getDb();
  const sql = `SELECT c.*, p.name AS requested_by_name
                 FROM work_session_corrections c
                 LEFT JOIN people p ON p.id = c.requested_by
                ${status ? "WHERE c.status = ?" : ""}
                ORDER BY c.created_at DESC`;
  return plainList<WorkCorrectionRow>(status ? db.prepare(sql).all(status) : db.prepare(sql).all());
}

export function requestWorkCorrection(input: {
  sessionId: string;
  personId: string;
  reason: string;
  proposedStartedAt: string | null;
  proposedEndedAt: string | null;
}): string {
  if (!input.reason.trim()) throw new Error("Düzeltme için gerekçe zorunlu.");
  if (!input.proposedStartedAt && !input.proposedEndedAt) {
    throw new Error("En az bir saat önerilmeli.");
  }
  if (input.proposedStartedAt && input.proposedEndedAt
      && parseStamp(input.proposedEndedAt) <= parseStamp(input.proposedStartedAt)) {
    throw new Error("Bitiş saati başlangıçtan sonra olmalı.");
  }
  const db = getDb();
  const session = db
    .prepare("SELECT * FROM work_sessions WHERE id = ? AND person_id = ?")
    .get(input.sessionId, input.personId) as WorkSessionRow | undefined;
  if (!session) throw new Error("Mesai kaydı bulunamadı.");
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO work_session_corrections
       (id, session_id, requested_by, reason, proposed_started_at, proposed_ended_at,
        previous_started_at, previous_ended_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, input.sessionId, input.personId, input.reason.trim(),
    input.proposedStartedAt, input.proposedEndedAt,
    session.started_at, session.ended_at,
  );
  return id;
}

/**
 * Düzeltmeyi karara bağlar. Onaylanırsa ESKİ değerler kayıtta korunarak yeni
 * saatler yazılır — "eski/yeni değerler korunsun" kuralı burada.
 */
export function decideWorkCorrection(input: {
  correctionId: string;
  approve: boolean;
  decidedBy: string;
  note: string | null;
}): void {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const correction = db
      .prepare("SELECT * FROM work_session_corrections WHERE id = ?")
      .get(input.correctionId) as WorkCorrectionRow | undefined;
    if (!correction) throw new Error("Düzeltme isteği bulunamadı.");
    if (correction.status !== "Beklemede") throw new Error("Bu istek zaten karara bağlanmış.");
    if (input.approve) {
      db.prepare(
        `UPDATE work_sessions
            SET started_at = COALESCE(?, started_at),
                ended_at = COALESCE(?, ended_at),
                updated_at = datetime('now')
          WHERE id = ?`,
      ).run(correction.proposed_started_at, correction.proposed_ended_at, correction.session_id);
    }
    db.prepare(
      `UPDATE work_session_corrections
          SET status = ?, decided_by = ?, decision_note = ?, decided_at = datetime('now')
        WHERE id = ?`,
    ).run(input.approve ? "Onaylandi" : "Reddedildi", input.decidedBy, input.note, input.correctionId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
