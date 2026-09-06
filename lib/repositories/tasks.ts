import { changeTaskStatuses, createTaskSuccessor } from "@/lib/taskLifecycle";
import { getDb, plainList, plainOne } from "@/lib/db/client";
import { NO_DEPARTMENT, type DepartmentKey } from "@/lib/departments";
import { departmentPeopleCondition } from "@/lib/repositories/people";
import { ARCHIVE_AFTER_DAYS } from "@/lib/taskArchive";
import { plannedTaskCondition } from "@/lib/taskPlanning";
import { assertWeightPoints, DIFFICULTY_DEFAULT_WEIGHT } from "@/lib/progress";
import type {
  ContentType,
  Task,
  TaskDifficulty,
  TaskPriority,
  TaskRevisionRound,
  TaskStatus,
  TaskWithContext,
} from "@/lib/types";

// Acil→Düşük sıralaması için ORDER BY'da kullanılan CASE ifadesi.
const PRIORITY_ORDER_SQL = `CASE t.priority
  WHEN 'Acil' THEN 0 WHEN 'Yuksek' THEN 1 WHEN 'Normal' THEN 2 ELSE 3 END`;

// Yorum özeti korelasyonlu alt sorgularla geliyor (JOIN + GROUP BY yerine):
// `t.*` seçildiği için GROUP BY tüm sütunları listelemeyi gerektirirdi ve yeni
// bir sütun eklendiğinde sessizce bozulurdu. `idx_comments_task` sayesinde her
// alt sorgu indeks üzerinden çalışıyor.
//
// created_at saniye hassasiyetinde (datetime('now')); aynı saniyede yazılan iki
// yorumda sıralama belirsiz kalmasın diye `rowid` ikinci anahtar.
const LAST_COMMENT_ORDER = "ORDER BY c.created_at DESC, c.rowid DESC LIMIT 1";

const WITH_CONTEXT_SELECT = `
  SELECT t.*, p.name AS assignee_name,
         p.avatar_path AS assignee_avatar_path,
         ci.title AS content_title, COALESCE(t.type_override, ci.type) AS content_type,
         b.id AS brand_id, b.name AS brand_name, b.accent_hue AS brand_accent_hue,
         (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) AS comment_count,
         (SELECT c.body FROM comments c
           WHERE c.task_id = t.id ${LAST_COMMENT_ORDER}) AS last_comment_body,
         (SELECT cp.name FROM comments c
            JOIN people cp ON cp.id = c.author_id
           WHERE c.task_id = t.id ${LAST_COMMENT_ORDER}) AS last_comment_author,
         (SELECT COUNT(*) FROM task_revision_rounds rr
           WHERE rr.task_id = t.id) AS revision_count,
         (SELECT rr.id FROM task_revision_rounds rr
           WHERE rr.task_id = t.id AND rr.completed_at IS NULL
           ORDER BY rr.round_number DESC LIMIT 1) AS active_revision_id,
         (SELECT rr.started_at FROM task_revision_rounds rr
           WHERE rr.task_id = t.id AND rr.completed_at IS NULL
           ORDER BY rr.round_number DESC LIMIT 1) AS active_revision_started_at,
         (SELECT rr.target_minutes FROM task_revision_rounds rr
           WHERE rr.task_id = t.id AND rr.completed_at IS NULL
           ORDER BY rr.round_number DESC LIMIT 1) AS active_revision_target_minutes,
         (SELECT MAX(0, CAST((unixepoch('now') - unixepoch(rr.started_at)) / 60 AS INTEGER))
            FROM task_revision_rounds rr
           WHERE rr.task_id = t.id AND rr.completed_at IS NULL
           ORDER BY rr.round_number DESC LIMIT 1) AS active_revision_elapsed_minutes,
         COALESCE((SELECT SUM(MAX(0, CAST((unixepoch(rr.completed_at) - unixepoch(rr.started_at)) / 60 AS INTEGER)))
            FROM task_revision_rounds rr
           WHERE rr.task_id = t.id AND rr.completed_at IS NOT NULL), 0) AS total_revision_minutes,
         (SELECT d.id FROM task_deliveries d
           WHERE d.task_id = t.id AND d.status = 'Beklemede'
           ORDER BY d.version_number DESC LIMIT 1) AS pending_delivery_id,
         (SELECT d.version_number FROM task_deliveries d
           WHERE d.task_id = t.id AND d.status = 'Beklemede'
           ORDER BY d.version_number DESC LIMIT 1) AS pending_delivery_version
  FROM tasks t
  JOIN content_items ci ON ci.id = t.content_item_id
  JOIN brands b ON b.id = ci.brand_id
  LEFT JOIN people p ON p.id = t.assignee_id
`;

// Arşivlenmemiş görevler için ortak koşul. Arşiv damgası YALNIZCA yayınlanmış
// işlere konur (bkz. lib/taskArchive.ts), bu yüzden "açık iş" sorgularının
// ayrıca bunu yazması gerekmez — ama pano/liste gibi yayınlananları da gösteren
// sorgular bunu EKLEMEK ZORUNDA, yoksa arşiv hiçbir yerde gizlenmez.
// Arşiv damgası artık YALNIZCA yayınlanmış işe konmuyor: "Görevi iptal et"
// düğmesi açık bir işi de arşivleyebiliyor (bkz. components/ArchiveTaskButton).
// Bu yüzden "gecikmiş" ve "bu hafta" sayaçları da bu koşulu uygulamak ZORUNDA —
// yoksa iptal edilen iş panodan düşüyor ama üstteki metrikte saymaya devam ediyor.
// Takvim (`listTasksDueInRange`) bilerek DIŞARIDA: geçmişi olduğu gibi gösteriyor.
const NOT_ARCHIVED = "t.archived_at IS NULL";
const IS_PLANNED = plannedTaskCondition("t");

export function listTasksByContent(contentItemId: string): TaskWithContext[] {
  return plainList<TaskWithContext>(
    getDb()
      .prepare(
        `${WITH_CONTEXT_SELECT} WHERE t.content_item_id = ? AND ${NOT_ARCHIVED} AND ${IS_PLANNED}
         ORDER BY ${PRIORITY_ORDER_SQL}, t.created_at`,
      )
      .all(contentItemId),
  );
}

// İçerik sayfasındaki katlanabilir "Arşiv" bölümü: kanban'dan düşmüş ama
// silinmemiş işler. En son arşivlenen en üstte.
export function listArchivedTasksByContent(contentItemId: string): TaskWithContext[] {
  return plainList<TaskWithContext>(
    getDb()
      .prepare(
        `${WITH_CONTEXT_SELECT} WHERE t.content_item_id = ? AND t.archived_at IS NOT NULL
         ORDER BY t.archived_at DESC, t.rowid DESC`,
      )
      .all(contentItemId),
  );
}

export function getTask(id: string): TaskWithContext | undefined {
  return plainOne<TaskWithContext>(
    getDb().prepare(`${WITH_CONTEXT_SELECT} WHERE t.id = ?`).get(id),
  );
}

// "/tasks" (Görevler) sayfası için — portföydeki tüm görevler, istemci
// tarafında filtrelenmek üzere tek seferde çekilir.
//
// `includeArchived` varsayılan olarak FALSE: arşiv, panoyu ve sayaçları
// kirletmesin. Görevler sayfası ise TRUE ile çağırıp arşivi de indiriyor —
// "Arşivi göster" düğmesi istemci tarafında çalışsın, tıklayınca sunucuya
// gidilmesin diye (aynı sayfadaki diğer filtreler de böyle).
export function listAllTasks(includeArchived = false): TaskWithContext[] {
  return plainList<TaskWithContext>(
    getDb()
      .prepare(
        `${WITH_CONTEXT_SELECT}
         WHERE ${IS_PLANNED}${includeArchived ? "" : ` AND ${NOT_ARCHIVED}`}
         ORDER BY ${PRIORITY_ORDER_SQL}, (t.due_date IS NULL), t.due_date, b.name`,
      )
      .all(),
  );
}

/** Marka çalışma alanı için en yakın açık işleri, tüm görev tablosunu taşımadan getirir. */
export function listOpenTasksByBrand(
  brandId: string,
  limit = 5,
): TaskWithContext[] {
  const safeLimit = Math.max(1, Math.min(25, Math.trunc(limit)));
  return plainList<TaskWithContext>(
    getDb()
      .prepare(
        `${WITH_CONTEXT_SELECT}
         WHERE b.id = ?
           AND t.status != 'Yayinlandi'
           AND ${NOT_ARCHIVED}
           AND ${IS_PLANNED}
         ORDER BY ${PRIORITY_ORDER_SQL}, (t.due_date IS NULL), t.due_date, t.created_at, t.id
         LIMIT ?`,
      )
      .all(brandId, safeLimit),
  );
}

export function listTasksDueThisWeek(
  start: string,
  end: string,
): TaskWithContext[] {
  return plainList<TaskWithContext>(
    getDb()
      .prepare(
        `${WITH_CONTEXT_SELECT}
         WHERE t.due_date IS NOT NULL AND t.due_date BETWEEN ? AND ?
           AND t.status != 'Yayinlandi' AND ${NOT_ARCHIVED}
         ORDER BY t.due_date, b.name`,
      )
      .all(start, end),
  );
}

// "/calendar" (Takvim) sayfası için — verilen aralıkta (ay ızgarası, dolgu
// günleri dahil) teslim tarihi olan TÜM görevler, durumdan bağımsız.
// `listTasksDueThisWeek`'in aksine 'Yayinlandi' filtrelenmiyor: takvim geçmiş
// bir ayı gösterirken tamamlanmış iş de o günün altında görünmeli, yoksa
// geçmiş aylar olduğundan daha boş görünür. Aynı gün içinde önce en öncelikli
// görev listelensin diye sıralama günün içinde de PRIORITY_ORDER_SQL kullanır
// — hücrede yalnızca ilk birkaçı gösterilip gerisi "+N daha" ile katlanıyor.
export function listTasksDueInRange(start: string, end: string): TaskWithContext[] {
  return plainList<TaskWithContext>(
    getDb()
      .prepare(
        `${WITH_CONTEXT_SELECT}
         WHERE t.due_date IS NOT NULL AND t.due_date BETWEEN ? AND ?
         ORDER BY t.due_date, ${PRIORITY_ORDER_SQL}, b.name`,
      )
      .all(start, end),
  );
}

export function listOverdueTasks(today: string): TaskWithContext[] {
  return plainList<TaskWithContext>(
    getDb()
      .prepare(
        `${WITH_CONTEXT_SELECT}
         WHERE t.due_date IS NOT NULL AND t.due_date < ?
           AND t.status != 'Yayinlandi' AND ${NOT_ARCHIVED}
         ORDER BY t.due_date, b.name`,
      )
      .all(today),
  );
}

// Panom'un board'u. Durum FİLTRELENMİYOR: yayınlanan iş, arşivlenene kadar
// "Yayınlandı" sütununda durur — yanlışlıkla oraya sürüklenen kart geri
// sürüklenebilsin diye. Arşivlenenler düşer (`NOT_ARCHIVED`).
export function listBoardTasksByAssignee(personId: string): TaskWithContext[] {
  return plainList<TaskWithContext>(
    getDb()
      .prepare(
        `${WITH_CONTEXT_SELECT}
         WHERE t.assignee_id = ? AND ${NOT_ARCHIVED} AND ${IS_PLANNED}
         ORDER BY (t.due_date IS NULL), t.due_date, b.name`,
      )
      .all(personId),
  );
}

// Rapor listeleri iki kapsamda çalışıyor: tek kişi (`/reports/kisi/...`) ve tek
// departman (`/reports/departman/...`). SQL tek yerde kalsın diye koşul burada
// üretiliyor; departman kapsamı `people.department` üzerinden dolaylı çalışır
// (bkz. `departmentPeopleCondition`) — atanmamış görev hiçbir departmana girmez.
type TaskScope = { personId: string } | { department: DepartmentKey };

function taskScopeCondition(scope: TaskScope): string {
  return "personId" in scope
    ? "t.assignee_id = :personId"
    : departmentPeopleCondition(scope.department, "t.assignee_id");
}

function taskScopeParams(scope: TaskScope): Record<string, string | number> {
  if ("personId" in scope) return { personId: scope.personId };
  // "Diğer" kovasının koşulu parametresiz (sabit NOT IN listesi).
  return scope.department === NO_DEPARTMENT ? {} : { department: scope.department };
}

// Raporlardaki "gecikmiş işler" listesi: en eski teslim tarihi en üstte —
// rapordaki gecikme sayısının arkasındaki gerçek işleri gösterir.
function listOverdueTasksForScope(scope: TaskScope, today: string): TaskWithContext[] {
  return plainList<TaskWithContext>(
    getDb()
      .prepare(
        `${WITH_CONTEXT_SELECT}
         WHERE ${taskScopeCondition(scope)} AND t.status != 'Yayinlandi'
           AND t.due_date IS NOT NULL AND t.due_date < :today
         ORDER BY t.due_date, ${PRIORITY_ORDER_SQL}, b.name`,
      )
      .all({ ...taskScopeParams(scope), today }),
  );
}

export function listOverdueTasksByAssignee(
  personId: string,
  today: string,
): TaskWithContext[] {
  return listOverdueTasksForScope({ personId }, today);
}

export function listOverdueTasksByDepartment(
  department: DepartmentKey,
  today: string,
): TaskWithContext[] {
  return listOverdueTasksForScope({ department }, today);
}

// Bugünden itibaren `days` gün içinde teslim edilecek açık işler (bugün dahil).
function listUpcomingTasksForScope(
  scope: TaskScope,
  today: string,
  days: number,
): TaskWithContext[] {
  return plainList<TaskWithContext>(
    getDb()
      .prepare(
        `${WITH_CONTEXT_SELECT}
         WHERE ${taskScopeCondition(scope)} AND t.status != 'Yayinlandi'
           AND t.due_date IS NOT NULL
           AND t.due_date >= :today
           AND t.due_date <= date(:today, '+' || :days || ' day')
         ORDER BY t.due_date, ${PRIORITY_ORDER_SQL}, b.name`,
      )
      .all({ ...taskScopeParams(scope), today, days }),
  );
}

export function listUpcomingTasksByAssignee(
  personId: string,
  today: string,
  days: number,
): TaskWithContext[] {
  return listUpcomingTasksForScope({ personId }, today, days);
}

export function listUpcomingTasksByDepartment(
  department: DepartmentKey,
  today: string,
  days: number,
): TaskWithContext[] {
  return listUpcomingTasksForScope({ department }, today, days);
}

// Son tamamlananlar. `completed_at` NULL olan eski kayıtlar (migration öncesi)
// listeye girmez — tarihsiz bir "en son" satırı sıralamayı yanıltırdı.
function listCompletedTasksForScope(scope: TaskScope, limit: number): TaskWithContext[] {
  return plainList<TaskWithContext>(
    getDb()
      .prepare(
        `${WITH_CONTEXT_SELECT}
         WHERE ${taskScopeCondition(scope)} AND t.status = 'Yayinlandi'
           AND t.completed_at IS NOT NULL
         ORDER BY t.completed_at DESC, t.rowid DESC
         LIMIT :limit`,
      )
      .all({ ...taskScopeParams(scope), limit }),
  );
}

export function listCompletedTasksByAssignee(
  personId: string,
  limit: number,
): TaskWithContext[] {
  return listCompletedTasksForScope({ personId }, limit);
}

export function listCompletedTasksByDepartment(
  department: DepartmentKey,
  limit: number,
): TaskWithContext[] {
  return listCompletedTasksForScope({ department }, limit);
}

export function createTask(input: {
  contentItemId: string;
  title: string;
  assigneeId: string | null;
  dueDate: string;
  contentType?: ContentType;
  weightPoints?: number;
  difficulty?: TaskDifficulty;
  priority?: TaskPriority;
}): string {
  if (!input.dueDate) throw new Error("Teslim tarihi zorunlu.");
  const weightPoints = assertWeightPoints(
    input.weightPoints ?? DIFFICULTY_DEFAULT_WEIGHT[input.difficulty ?? "Orta"],
  );
  const id = crypto.randomUUID();
  getDb()
    .prepare(
      "INSERT INTO tasks (id, content_item_id, title, type_override, assignee_id, due_date, difficulty, priority, weight_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      id,
      input.contentItemId,
      input.title,
      input.contentType ?? null,
      input.assigneeId,
      input.dueDate,
      input.difficulty ?? "Orta",
      input.priority ?? "Normal",
      weightPoints,
    );
  return id;
}

export function updateTaskRepeat(id: string, repeatDays: number | null): void {
  getDb()
    .prepare("UPDATE tasks SET repeat_days = ?, updated_at = datetime('now') WHERE id = ?")
    .run(repeatDays, id);
}

// Compatibility entry point: re-read the source under a write lock.
export function createNextOccurrence(task: Task & { content_type?: ContentType }, _today: string): string {
  void _today;
  return createTaskSuccessor(task.id);
}

export function listArchivedTasks(): TaskWithContext[] {
  return plainList<TaskWithContext>(
    getDb()
      .prepare(
        `${WITH_CONTEXT_SELECT}
         WHERE t.archived_at IS NOT NULL
         ORDER BY t.archived_at DESC, b.name, t.title`,
      )
      .all(),
  );
}

export function countArchivedTasks(): number {
  return Number(
    (getDb().prepare("SELECT COUNT(*) AS n FROM tasks WHERE archived_at IS NOT NULL").get() as { n: number }).n,
  );
}

export function updateTaskStatus(id: string, status: TaskStatus, actorId: string | null = null): boolean {
  return changeTaskStatuses([id], status, actorId) > 0;
}

export function updateTaskPriority(id: string, priority: TaskPriority): boolean {
  const result = getDb()
    .prepare(
      "UPDATE tasks SET priority = ?, updated_at = datetime('now') WHERE id = ? AND priority <> ?",
    )
    .run(priority, id, priority);
  return Number(result.changes) === 1;
}

export function updateTaskDueDate(id: string, dueDate: string): void {
  if (!dueDate) throw new Error("Teslim tarihi zorunlu.");
  getDb()
    .prepare("UPDATE tasks SET due_date = ?, updated_at = datetime('now') WHERE id = ?")
    .run(dueDate, id);
}

export function updateTaskAssignee(id: string, assigneeId: string | null): boolean {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const current = db.prepare("SELECT assignee_id FROM tasks WHERE id = ?").get(id) as
      | { assignee_id: string | null }
      | undefined;
    if (!current || current.assignee_id === assigneeId) {
      db.exec("COMMIT");
      return false;
    }
    db.prepare(
      "UPDATE tasks SET assignee_id = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(assigneeId, id);
    db.prepare("DELETE FROM task_personal_targets WHERE task_id = ?").run(id);
    db.exec("COMMIT");
    return true;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function updateTaskDetails(input: {
  id: string;
  title: string;
  contentType: ContentType;
  dueDate: string;
  notes: string | null;
}, attachments: Array<{ filePath: string; originalName: string | null }> = []): void {
  if (!input.dueDate) throw new Error("Teslim tarihi zorunlu.");
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = db.prepare(
      "UPDATE tasks SET title = ?, type_override = ?, due_date = ?, notes = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .run(input.title, input.contentType, input.dueDate, input.notes, input.id);
    if (Number(result.changes) !== 1) throw new Error("Görev bulunamadı.");
    const insertAttachment = db.prepare(
      "INSERT INTO task_attachments (id, task_id, file_path, original_name) VALUES (?, ?, ?, ?)",
    );
    for (const attachment of attachments) {
      insertAttachment.run(crypto.randomUUID(), input.id, attachment.filePath, attachment.originalName);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function updateTaskDifficulty(id: string, difficulty: TaskDifficulty): boolean {
  const result = getDb()
    .prepare(
      "UPDATE tasks SET difficulty = ?, updated_at = datetime('now') WHERE id = ? AND (difficulty IS NULL OR difficulty <> ?)",
    )
    .run(difficulty, id, difficulty);
  return Number(result.changes) === 1;
}

export function listTaskRevisions(taskId: string): TaskRevisionRound[] {
  return plainList<TaskRevisionRound>(
    getDb()
      .prepare(
        `SELECT rr.*,
                creator.name AS created_by_name,
                completer.name AS completed_by_name,
                MAX(0, CAST((unixepoch(COALESCE(rr.completed_at, 'now')) - unixepoch(rr.started_at)) / 60 AS INTEGER)) AS elapsed_minutes
           FROM task_revision_rounds rr
           LEFT JOIN people creator ON creator.id = rr.created_by
           LEFT JOIN people completer ON completer.id = rr.completed_by
          WHERE rr.task_id = ?
          ORDER BY rr.round_number DESC`,
      )
      .all(taskId),
  );
}

export function startTaskRevision(input: {
  taskId: string;
  targetMinutes: number;
  note: string | null;
  actorId: string;
}): TaskRevisionRound {
  if (!Number.isInteger(input.targetMinutes) || input.targetMinutes < 15 || input.targetMinutes > 10080) {
    throw new Error("Revize hedef süresi 15 dakika ile 7 gün arasında olmalı.");
  }
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const task = db
      .prepare("SELECT status, archived_at, due_date FROM tasks WHERE id = ?")
      .get(input.taskId) as {
        status: TaskStatus;
        archived_at: string | null;
        due_date: string | null;
      } | undefined;
    if (!task) throw new Error("Görev bulunamadı.");
    if (task.archived_at !== null) throw new Error("Arşivlenmiş görevde revize başlatılamaz.");
    if (task.due_date === null) {
      throw new Error("Revize başlamadan önce iç teslim tarihi atanmalı.");
    }
    if (task.status === "Yayinlandi") {
      throw new Error("Revize başlatmadan önce görevi yeniden açın.");
    }
    const active = db
      .prepare("SELECT 1 FROM task_revision_rounds WHERE task_id = ? AND completed_at IS NULL")
      .get(input.taskId);
    if (active) throw new Error("Bu görevde zaten aktif bir revize turu var.");
    const next = db
      .prepare("SELECT COALESCE(MAX(round_number), 0) + 1 AS n FROM task_revision_rounds WHERE task_id = ?")
      .get(input.taskId) as { n: number };
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO task_revision_rounds
         (id, task_id, round_number, target_minutes, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, input.taskId, next.n, input.targetMinutes, input.note, input.actorId);
    db.prepare("UPDATE tasks SET updated_at = datetime('now') WHERE id = ?").run(input.taskId);
    db.exec("COMMIT");
    return listTaskRevisions(input.taskId).find((round) => round.id === id)!;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function completeTaskRevision(revisionId: string, actorId: string): TaskRevisionRound {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const current = db
      .prepare("SELECT task_id, completed_at FROM task_revision_rounds WHERE id = ?")
      .get(revisionId) as { task_id: string; completed_at: string | null } | undefined;
    if (!current) throw new Error("Revize turu bulunamadı.");
    if (current.completed_at !== null) throw new Error("Revize turu zaten tamamlandı.");
    db.prepare(
      `UPDATE task_revision_rounds
          SET completed_at = datetime('now'), completed_by = ?, updated_at = datetime('now')
        WHERE id = ?`,
    ).run(actorId, revisionId);
    db.prepare("UPDATE tasks SET updated_at = datetime('now') WHERE id = ?").run(current.task_id);
    db.exec("COMMIT");
    return listTaskRevisions(current.task_id).find((round) => round.id === revisionId)!;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function updateTaskWeight(id: string, weightPoints: number): void {
  getDb().prepare(
    "UPDATE tasks SET weight_points = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(weightPoints, id);
}

// ---- Arşiv ----
// Görev SİLİNMEZ, yalnızca `archived_at` damgalanır: rapor/takvim okumaya devam
// eder, tek tıkla geri alınır.

/**
 * Tamamlanmasının üzerinden `days` gün geçmiş yayınlanmış işleri arşivler.
 * Kaç görevin damgalandığını döner.
 *
 * Cron/arka plan işi yok: görev listeleyen sayfalar (`force-dynamic` olduğu için
 * her istekte) render'dan ÖNCE bunu çağırır. Tek `UPDATE`, `idx_tasks_archived_at`
 * üzerinden çalışır ve arşivlenecek iş yoksa hiçbir satıra dokunmaz — sayfa
 * başına maliyeti ihmal edilebilir.
 */
export function sweepArchivablePublishedTasks(days = ARCHIVE_AFTER_DAYS): number {
  return Number(
    getDb()
      .prepare(
        `UPDATE tasks
            SET archived_at = datetime('now')
          WHERE archived_at IS NULL
            AND status = 'Yayinlandi'
            AND completed_at IS NOT NULL
            AND julianday('now') - julianday(completed_at) >= ?`,
      )
      .run(days).changes,
  );
}

// Elle arşivleme / arşivden çıkarma. Durum DEĞİŞMEZ: arşivden çıkan görev hâlâ
// "Yayınlandı"dır, sadece panoda yeniden görünür (yanlış işaretlemeyi düzeltmek
// için kullanıcı durumu ayrıca geri alır).
export function setTaskArchived(id: string, archived: boolean): void {
  const db = getDb();
  if (
    archived &&
    db.prepare(
      "SELECT 1 FROM task_revision_rounds WHERE task_id = ? AND completed_at IS NULL",
    ).get(id)
  ) {
    throw new Error("Görev arşivlenmeden önce aktif revize turu tamamlanmalı.");
  }
  if (
    archived &&
    db.prepare(
      "SELECT 1 FROM task_deliveries WHERE task_id = ? AND status = 'Beklemede'",
    ).get(id)
  ) {
    throw new Error("Görev arşivlenmeden önce bekleyen teslim için karar verilmeli.");
  }
  db
    .prepare(
      `UPDATE tasks
          SET archived_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END,
              updated_at = datetime('now')
        WHERE id = ?`,
    )
    .run(archived ? 1 : 0, id);
}

export function deleteTask(id: string): Task | undefined {
  const db = getDb();
  const task = plainOne<Task>(
    db.prepare("SELECT * FROM tasks WHERE id = ?").get(id),
  );
  db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
  return task;
}

// ---- Toplu işlemler ----
// Tek UPDATE/DELETE ile `WHERE id IN (?, ?, …)` — hepsi tek statement'ta atomik
// çalışır. Boş liste no-op. Placeholder sayısı id sayısına göre üretiliyor.

export function bulkUpdateTaskStatus(
  ids: string[],
  status: TaskStatus,
  actorId: string | null = null,
): number {
  return changeTaskStatuses(ids, status, actorId);
}

export function bulkUpdateTaskPriority(ids: string[], priority: TaskPriority): number {
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => "?").join(", ");
  const result = getDb()
    .prepare(
      `UPDATE tasks SET priority = ?, updated_at = datetime('now')
        WHERE id IN (${placeholders}) AND priority <> ?`,
    )
    .run(priority, ...ids, priority);
  return Number(result.changes);
}

export function bulkUpdateTaskAssignee(ids: string[], assigneeId: string | null): number {
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => "?").join(", ");
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const current = plainList<{ id: string; assignee_id: string | null }>(
      db.prepare(`SELECT id, assignee_id FROM tasks WHERE id IN (${placeholders})`).all(...ids),
    );
    const changedIds = current
      .filter((task) => task.assignee_id !== assigneeId)
      .map((task) => task.id);
    if (changedIds.length === 0) {
      db.exec("COMMIT");
      return 0;
    }

    const changedPlaceholders = changedIds.map(() => "?").join(", ");
    db.prepare(
      `UPDATE tasks SET assignee_id = ?, updated_at = datetime('now')
        WHERE id IN (${changedPlaceholders})`,
    ).run(assigneeId, ...changedIds);
    db.prepare(
      `DELETE FROM task_personal_targets WHERE task_id IN (${changedPlaceholders})`,
    ).run(...changedIds);
    db.exec("COMMIT");
    return changedIds.length;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function bulkDeleteTasks(ids: string[]): number {
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => "?").join(", ");
  return Number(getDb().prepare(`DELETE FROM tasks WHERE id IN (${placeholders})`).run(...ids).changes);
}
