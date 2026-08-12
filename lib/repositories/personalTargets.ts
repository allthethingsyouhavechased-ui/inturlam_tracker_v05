import { getDb, plainList } from "@/lib/db/client";
import type { PersonalTaskTarget } from "@/lib/types";

interface TargetableTask {
  assignee_id: string | null;
  status: string;
  origin: "team" | "guest";
  due_date: string | null;
}

function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function listPersonalTaskTargets(personId: string): PersonalTaskTarget[] {
  return plainList<PersonalTaskTarget>(
    getDb()
      .prepare(
        `SELECT task_id, person_id, target_date, updated_at
           FROM task_personal_targets
          WHERE person_id = ?
          ORDER BY target_date, updated_at`,
      )
      .all(personId),
  );
}

export function setPersonalTaskTarget(
  taskId: string,
  personId: string,
  targetDate: string | null,
  today: string,
): void {
  const db = getDb();
  const task = db
    .prepare("SELECT assignee_id, status, origin, due_date FROM tasks WHERE id = ?")
    .get(taskId) as TargetableTask | undefined;

  if (!task) throw new Error("Görev bulunamadı.");
  if (task.assignee_id !== personId) {
    throw new Error("Kişisel hedefi yalnızca sana atanmış bir görev için değiştirebilirsin.");
  }
  if (task.origin === "guest" && task.due_date === null && targetDate !== null) {
    throw new Error("Kişisel hedeften önce iç teslim tarihi atanmalı.");
  }

  if (targetDate === null) {
    db.prepare("DELETE FROM task_personal_targets WHERE task_id = ? AND person_id = ?")
      .run(taskId, personId);
    return;
  }

  if (task.status === "Yayinlandi") {
    throw new Error("Tamamlanmış görev için yeni kişisel hedef belirlenemez.");
  }
  if (!isValidISODate(targetDate)) throw new Error("Geçersiz kişisel hedef tarihi.");
  if (targetDate < today) throw new Error("Kişisel hedef geçmiş bir tarih olamaz.");

  db.prepare(
    `INSERT INTO task_personal_targets (task_id, person_id, target_date)
     VALUES (?, ?, ?)
     ON CONFLICT(task_id, person_id) DO UPDATE SET
       target_date = excluded.target_date,
       updated_at = datetime('now')`,
  ).run(taskId, personId, targetDate);
}
