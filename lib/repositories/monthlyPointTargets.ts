import { getDb, plainList } from "@/lib/db/client";
import { assertTargetMonth, assertTargetPoints, calculatePointTargetProgress, type PointTargetProgress } from "@/lib/monthlyPointTargets";
import { getPersonMonthlyProgressSummary } from "@/lib/repositories/progress";

export interface PersonPointTargetRow extends PointTargetProgress {
  person_id: string;
  person_name: string;
  department: string | null;
  active: number;
}

export interface PointTargetChange {
  id: string;
  person_name: string;
  previous_points: number | null;
  target_points: number;
  actor_name: string;
  note: string | null;
  created_at: string;
}

export interface PointTargetUpdate {
  personId: string;
  targetPoints: number;
  expectedPoints: number | null;
}

export function getPersonPointTargetProgress(personId: string, month: string): PointTargetProgress {
  assertTargetMonth(month);
  const target = getDb().prepare("SELECT target_points FROM person_monthly_point_targets WHERE person_id = ? AND month = ?")
    .get(personId, month) as { target_points: number } | undefined;
  return calculatePointTargetProgress(getPersonMonthlyProgressSummary(personId, month), target?.target_points ?? null);
}

export function listMonthlyPointTargets(month: string): PersonPointTargetRow[] {
  assertTargetMonth(month);
  const people = plainList<{ person_id: string; person_name: string; department: string | null; active: number }>(getDb().prepare(`
    SELECT p.id AS person_id, p.name AS person_name, p.department, p.active FROM people p
    WHERE p.active = 1 OR EXISTS (SELECT 1 FROM person_monthly_point_targets t WHERE t.person_id = p.id AND t.month = ?)
    ORDER BY p.active DESC, p.name, p.id
  `).all(month));
  return people.map(person => ({ ...person, ...getPersonPointTargetProgress(person.person_id, month) }));
}

export function listPointTargetChanges(month: string): PointTargetChange[] {
  assertTargetMonth(month);
  return plainList<PointTargetChange>(getDb().prepare(`
    SELECT c.id, p.name AS person_name, c.previous_points, c.target_points, c.actor_name, c.note, c.created_at
    FROM person_monthly_point_target_changes c JOIN people p ON p.id = c.person_id
    WHERE c.month = ? ORDER BY c.created_at DESC, c.rowid DESC LIMIT 100
  `).all(month));
}

export function saveMonthlyPointTargets(actorId: string, month: string, updates: PointTargetUpdate[], note = ""): number {
  assertTargetMonth(month);
  if (!Array.isArray(updates) || updates.length === 0 || updates.length > 500) throw new Error("Kaydedilecek kişileri seçin (en fazla 500 kişi).");
  if (typeof note !== "string" || note.length > 500) throw new Error("Açıklama en fazla 500 karakter olabilir.");
  const seen = new Set<string>();
  for (const update of updates) {
    if (!update || typeof update.personId !== "string" || seen.has(update.personId)) throw new Error("Kişi listesi geçersiz veya tekrarlı.");
    seen.add(update.personId);
    assertTargetPoints(update.targetPoints);
    if (update.expectedPoints !== null) assertTargetPoints(update.expectedPoints);
  }
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const actor = db.prepare("SELECT name FROM people WHERE id = ? AND active = 1 AND is_manager = 1").get(actorId) as { name: string } | undefined;
    if (!actor) throw new Error("Hedefleri yalnızca yöneticiler değiştirebilir.");
    let changed = 0;
    for (const update of updates) {
      const person = db.prepare("SELECT name, active FROM people WHERE id = ?").get(update.personId) as { name: string; active: number } | undefined;
      if (!person) throw new Error("Ekip üyesi bulunamadı. Listeyi yenileyin.");
      const row = db.prepare("SELECT target_points FROM person_monthly_point_targets WHERE person_id = ? AND month = ?")
        .get(update.personId, month) as { target_points: number } | undefined;
      const current = row?.target_points ?? null;
      if (current === update.targetPoints) continue; // Aynı isteğin tekrarında kayıt ve geçmiş çoğalmaz.
      if (current !== update.expectedPoints) throw new Error(`${person.name} için hedef değişmiş. Sayfayı yenileyip tekrar deneyin.`);
      if (!person.active && current === null) throw new Error("Pasif üyeye yeni hedef atanamaz.");
      db.prepare(`INSERT INTO person_monthly_point_targets(person_id, month, target_points, updated_by)
        VALUES (?, ?, ?, ?) ON CONFLICT(person_id, month) DO UPDATE SET
        target_points = excluded.target_points, updated_by = excluded.updated_by, updated_at = datetime('now')`)
        .run(update.personId, month, update.targetPoints, actorId);
      db.prepare(`INSERT INTO person_monthly_point_target_changes(id, person_id, month, previous_points, target_points, actor_id, actor_name, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(crypto.randomUUID(), update.personId, month, current, update.targetPoints, actorId, actor.name, note.trim() || null);
      changed++;
    }
    db.exec("COMMIT");
    return changed;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
