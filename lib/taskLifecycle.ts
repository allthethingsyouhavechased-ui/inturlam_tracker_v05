import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/lib/db/client";
import { TASK_STATUSES } from "@/lib/constants";
import { settlePackagesForTask } from "@/lib/repositories/pointPackages";
import type { Task, TaskStatus } from "@/lib/types";

export class TaskTransitionError extends Error {}

/** Repeat intervals are elapsed calendar days, never calendar-month arithmetic. */
export function nextOccurrenceDate(dueDate: string | null, repeatDays: number | null): string {
  if (!dueDate) throw new TaskTransitionError("Tekrar eden görev için önce teslim tarihi atanmalı.");
  const date = new Date(`${dueDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dueDate) {
    throw new TaskTransitionError("Tekrar eden görevin teslim tarihi geçersiz.");
  }
  if (!Number.isInteger(repeatDays) || (repeatDays ?? 0) < 1 || (repeatDays ?? 0) > 365) {
    throw new TaskTransitionError("Tekrar aralığı 1–365 gün arasında olmalı.");
  }
  date.setUTCDate(date.getUTCDate() + repeatDays!);
  const result = date.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new TaskTransitionError("Sonraki teslim tarihi desteklenen aralığı aşıyor.");
  return result;
}

// Must run inside the caller's write transaction; source and successor form one commit.
function ensureSuccessor(db: DatabaseSync, task: Task): string | null {
  const existing = db.prepare("SELECT successor_task_id FROM task_recurrence_occurrences WHERE source_task_id = ?").get(task.id) as { successor_task_id: string | null } | undefined;
  if (existing) return existing.successor_task_id;
  const date = nextOccurrenceDate(task.due_date, task.repeat_days);
  const series = db.prepare("SELECT series_id FROM task_recurrence_occurrences WHERE successor_task_id = ?").get(task.id) as { series_id: string } | undefined;
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO tasks
    (id, content_item_id, title, type_override, priority, difficulty, weight_points, assignee_id, due_date, repeat_days)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, task.content_item_id, task.title, task.type_override, task.priority,
    task.difficulty, task.weight_points, task.assignee_id, date, task.repeat_days,
  );
  // Notes, comments, attachments, guest sharing, deliveries and revisions belong to the old occurrence.
  db.prepare("INSERT INTO task_recurrence_occurrences (source_task_id, successor_task_id, series_id) VALUES (?, ?, ?)").run(task.id, id, series?.series_id ?? task.id);
  return id;
}

export function createTaskSuccessor(taskId: string): string {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as unknown as Task | undefined;
    if (!task) throw new TaskTransitionError("Görev bulunamadı.");
    const id = ensureSuccessor(db, task);
    if (!id) throw new TaskTransitionError("Sonraki görev daha önce oluşturulup silinmiş; otomatik olarak tekrar oluşturulmaz.");
    db.exec("COMMIT");
    return id;
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}

/** Son teslim sürümü için geçerli (iptal edilmemiş) müşteri onayı var mı. */
export function hasValidCustomerApproval(db: DatabaseSync, taskId: string): boolean {
  const latest = db
    .prepare("SELECT id FROM task_deliveries WHERE task_id = ? ORDER BY version_number DESC LIMIT 1")
    .get(taskId) as { id: string } | undefined;
  // Hiç teslim yoksa onay da bir sürüme bağlanamaz; sürümsüz onay kabul edilir.
  const row = latest
    ? db.prepare(
        `SELECT 1 FROM task_customer_approvals
          WHERE task_id = ? AND invalidated_at IS NULL AND delivery_id = ?`,
      ).get(taskId, latest.id)
    : db.prepare(
        "SELECT 1 FROM task_customer_approvals WHERE task_id = ? AND invalidated_at IS NULL",
      ).get(taskId);
  return Boolean(row);
}

export function assertTaskTransition(db: DatabaseSync, task: Pick<Task, "id" | "origin" | "due_date">, status: TaskStatus, actorId: string | null, validatedDeliveryDecision = false): void {
  if (status !== "Beklemede" && task.origin === "guest" && !task.due_date) {
    throw new TaskTransitionError("Guest görevi ilerletilmeden önce iç teslim tarihi atanmalı.");
  }
  const pending = db.prepare("SELECT 1 FROM task_deliveries WHERE task_id = ? AND status = 'Beklemede'").get(task.id);
  if (pending && status !== "Incelemede") {
    throw new TaskTransitionError("Bekleyen teslim için önce teslim kartından karar verilmeli.");
  }
  // "Revizede" yalnızca gerçekten açık bir revize turu varken geçerli bir
  // durumdur; aksi hâlde pano sürüklemesi işi anlamsız bir kovaya taşırdı.
  if (status === "Revizede") {
    if (!db.prepare("SELECT 1 FROM task_revision_rounds WHERE task_id = ? AND completed_at IS NULL").get(task.id)) {
      throw new TaskTransitionError("Revizede durumu için açık bir revize turu gerekli; teslim kartından revize isteyin.");
    }
    return;
  }
  const needsTeamApproval = status === "Onaylandi" || status === "MusteriIncelemede"
    || status === "MusteriOnayladi" || status === "Yayinlandi";
  if (!needsTeamApproval) return;
  if (db.prepare("SELECT 1 FROM task_revision_rounds WHERE task_id = ? AND completed_at IS NULL").get(task.id)) {
    throw new TaskTransitionError("Görev onaylanmadan veya yayınlanmadan önce aktif revize turu tamamlanmalı.");
  }
  const latest = db.prepare("SELECT status FROM task_deliveries WHERE task_id = ? ORDER BY version_number DESC LIMIT 1").get(task.id) as { status: string } | undefined;
  if (latest && latest.status !== "Onaylandi") {
    throw new TaskTransitionError("Görevin son teslim sürümü onaylanmadan görev onaylanamaz veya yayınlanamaz.");
  }
  if (status === "Onaylandi" && !validatedDeliveryDecision && !db.prepare("SELECT 1 FROM people WHERE id = ? AND active = 1 AND is_manager = 1").get(actorId)) {
    throw new TaskTransitionError("Ekip teslim onayını yalnızca yöneticiler verebilir.");
  }

  const flags = db
    .prepare("SELECT customer_approval_required FROM tasks WHERE id = ?")
    .get(task.id) as { customer_approval_required: number } | undefined;
  const customerRequired = flags?.customer_approval_required === 1;

  // Müşteri aşamaları yalnızca o görev için müşteri onayı gerekiyorsa anlamlı.
  if ((status === "MusteriIncelemede" || status === "MusteriOnayladi") && !customerRequired) {
    throw new TaskTransitionError("Bu görevde müşteri onayı gerekmiyor; ekip onayından sonra doğrudan yayınlanabilir.");
  }
  // "Onaylandı (Müşteri)" bir KAYDA dayanır: onayı kim verdi, hangi kanaldan,
  // hangi teslim sürümü için. Kayıt yoksa durum elle işaretlenemez.
  if (status === "MusteriOnayladi" && !hasValidCustomerApproval(db, task.id)) {
    throw new TaskTransitionError("Önce müşteri onayını kaydedin: onayı veren kişi, kanal ve teslim sürümü gerekli.");
  }
  if (status === "Yayinlandi" && customerRequired && !hasValidCustomerApproval(db, task.id)) {
    throw new TaskTransitionError("Bu görev müşteri onayı olmadan yayınlanamaz.");
  }
}

/** All entry points select current state after acquiring the same SQLite write lock. */
export function changeTaskStatuses(ids: string[], status: TaskStatus, actorId: string | null): number {
  // Eski (v02) "IptalEdildi" TASK_STATUSES'ta yok: kayıtları okunabilir ama
  // yeni bir göreve ATANAMAZ — iptal artık `archived_at` ile modelleniyor.
  if (!TASK_STATUSES.includes(status)) throw new TaskTransitionError("Geçersiz durum.");
  if (ids.length === 0) return 0;
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const rows = [...new Set(ids)].flatMap((id) => {
      const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as unknown as Task | undefined;
      return task ? [task] : [];
    });
    const changed = rows.filter(task => task.status !== status);
    for (const task of changed) assertTaskTransition(db, task, status, actorId);
    for (const task of changed) {
      db.prepare(`UPDATE tasks SET status = ?, completed_at = CASE WHEN ? = 'Yayinlandi' THEN datetime('now') ELSE NULL END,
        completed_by = CASE WHEN ? = 'Yayinlandi' THEN ? ELSE NULL END, archived_at = NULL, updated_at = datetime('now') WHERE id = ?`).run(status, status, status, actorId, task.id);
      db.prepare("INSERT INTO task_status_events (id, task_id, from_status, to_status, actor_id) VALUES (?, ?, ?, ?, ?)").run(crypto.randomUUID(), task.id, task.status, status, actorId);
      // Puan yazımı ve onay AYNI transaction'da: tekrar onay, yeniden deneme
      // ve eşzamanlı istek çift kayıt üretemesin (entry_key UNIQUE).
      settlePackagesForTask(db, task.id);
      if (status === "Yayinlandi") {
        db.prepare("DELETE FROM task_personal_targets WHERE task_id = ?").run(task.id);
        if ((task.repeat_days ?? 0) > 0) ensureSuccessor(db, task);
      }
    }
    db.exec("COMMIT");
    return changed.length;
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}
