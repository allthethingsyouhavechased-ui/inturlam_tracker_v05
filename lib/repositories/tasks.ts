import { getDb, plainList, plainOne } from "@/lib/db/client";
import { NO_DEPARTMENT, type DepartmentKey } from "@/lib/departments";
import { departmentPeopleCondition } from "@/lib/repositories/people";
import { ARCHIVE_AFTER_DAYS } from "@/lib/taskArchive";
import type { Task, TaskPriority, TaskStatus, TaskWithContext } from "@/lib/types";

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
         ci.title AS content_title, ci.type AS content_type,
         b.id AS brand_id, b.name AS brand_name,
         (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) AS comment_count,
         (SELECT c.body FROM comments c
           WHERE c.task_id = t.id ${LAST_COMMENT_ORDER}) AS last_comment_body,
         (SELECT cp.name FROM comments c
            JOIN people cp ON cp.id = c.author_id
           WHERE c.task_id = t.id ${LAST_COMMENT_ORDER}) AS last_comment_author
  FROM tasks t
  JOIN content_items ci ON ci.id = t.content_item_id
  JOIN brands b ON b.id = ci.brand_id
  LEFT JOIN people p ON p.id = t.assignee_id
`;

// Arşivlenmemiş görevler için ortak koşul. Arşiv damgası YALNIZCA yayınlanmış
// işlere konur (bkz. lib/taskArchive.ts), bu yüzden "açık iş" sorgularının
// ayrıca bunu yazması gerekmez — ama pano/liste gibi yayınlananları da gösteren
// sorgular bunu EKLEMEK ZORUNDA, yoksa arşiv hiçbir yerde gizlenmez.
const NOT_ARCHIVED = "t.archived_at IS NULL";

export function listTasksByContent(contentItemId: string): TaskWithContext[] {
  return plainList<TaskWithContext>(
    getDb()
      .prepare(
        `${WITH_CONTEXT_SELECT} WHERE t.content_item_id = ? AND ${NOT_ARCHIVED}
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
         ${includeArchived ? "" : `WHERE ${NOT_ARCHIVED}`}
         ORDER BY ${PRIORITY_ORDER_SQL}, (t.due_date IS NULL), t.due_date, b.name`,
      )
      .all(),
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
           AND t.status != 'Yayinlandi'
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
           AND t.status != 'Yayinlandi'
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
         WHERE t.assignee_id = ? AND ${NOT_ARCHIVED}
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
  priority?: TaskPriority;
}): string {
  if (!input.dueDate) throw new Error("Teslim tarihi zorunlu.");
  const id = crypto.randomUUID();
  getDb()
    .prepare(
      "INSERT INTO tasks (id, content_item_id, title, assignee_id, due_date, priority) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      id,
      input.contentItemId,
      input.title,
      input.assigneeId,
      input.dueDate,
      input.priority ?? "Normal",
    );
  return id;
}

export function updateTaskRepeat(id: string, repeatDays: number | null): void {
  getDb()
    .prepare("UPDATE tasks SET repeat_days = ?, updated_at = datetime('now') WHERE id = ?")
    .run(repeatDays, id);
}

// Tekrar eden görevin bir sonraki örneğini açar. Tarih, ESKİ görevin teslim
// tarihine göre kayar (bugüne göre değil) — geç tamamlanan haftalık iş takvimi
// kaydırmasın. Tarihi yoksa bugünden itibaren hesaplanır.
export function createNextOccurrence(task: Task, _today: string): string {
  void _today;
  const base = task.due_date;
  if (!base) throw new Error("Tekrar eden görev için önce teslim tarihi atanmalı.");
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (task.repeat_days ?? 0));
  const id = crypto.randomUUID();
  getDb()
    .prepare(
      `INSERT INTO tasks (id, content_item_id, title, priority, assignee_id, due_date, notes, repeat_days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      task.content_item_id,
      task.title,
      task.priority,
      task.assignee_id,
      d.toISOString().slice(0, 10),
      task.notes,
      task.repeat_days,
    );
  return id;
}

interface TaskStatusRow {
  id: string;
  status: TaskStatus;
}

function applyTaskStatusChanges(
  tasks: TaskStatusRow[],
  status: TaskStatus,
  actorId: string | null,
): number {
  const changed = tasks.filter((task) => task.status !== status);
  if (changed.length === 0) return 0;

  const db = getDb();
  // `archived_at = NULL`: HER durum değişikliği görevi panoya geri koyar ve
  // arşiv sayacını sıfırlar. İki yönü de gerekli — arşivlenmiş bir iş yeniden
  // açıldığında görünmez kalmamalı, yeniden yayınlandığında da hemen arşive
  // düşmemeli (yeni `completed_at` zaten sayacı baştan başlatır).
  const update = db.prepare(`
    UPDATE tasks
       SET status = ?,
           completed_at = CASE
             WHEN ? = 'Yayinlandi' THEN datetime('now')
             ELSE NULL
           END,
           completed_by = CASE
             WHEN ? = 'Yayinlandi' THEN ?
             ELSE NULL
           END,
           archived_at = NULL,
           updated_at = datetime('now')
     WHERE id = ?
  `);
  const insertEvent = db.prepare(`
    INSERT INTO task_status_events
      (id, task_id, from_status, to_status, actor_id)
    VALUES (?, ?, ?, ?, ?)
  `);
  const clearPersonalTargets = db.prepare(
    "DELETE FROM task_personal_targets WHERE task_id = ?",
  );

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const task of changed) {
      update.run(status, status, status, actorId, task.id);
      insertEvent.run(crypto.randomUUID(), task.id, task.status, status, actorId);
      if (status === "Yayinlandi") clearPersonalTargets.run(task.id);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return changed.length;
}

export function updateTaskStatus(
  id: string,
  status: TaskStatus,
  actorId: string | null = null,
): boolean {
  const task = plainOne<TaskStatusRow>(
    getDb().prepare("SELECT id, status FROM tasks WHERE id = ?").get(id),
  );
  if (!task) return false;
  return applyTaskStatusChanges([task], status, actorId) > 0;
}

export function updateTaskPriority(id: string, priority: TaskPriority): void {
  getDb()
    .prepare(
      "UPDATE tasks SET priority = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .run(priority, id);
}

export function updateTaskDueDate(id: string, dueDate: string): void {
  if (!dueDate) throw new Error("Teslim tarihi zorunlu.");
  getDb()
    .prepare("UPDATE tasks SET due_date = ?, updated_at = datetime('now') WHERE id = ?")
    .run(dueDate, id);
}

export function updateTaskAssignee(id: string, assigneeId: string | null): void {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const current = db.prepare("SELECT assignee_id FROM tasks WHERE id = ?").get(id) as
      | { assignee_id: string | null }
      | undefined;
    if (!current || current.assignee_id === assigneeId) {
      db.exec("COMMIT");
      return;
    }
    db.prepare(
      "UPDATE tasks SET assignee_id = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(assigneeId, id);
    db.prepare("DELETE FROM task_personal_targets WHERE task_id = ?").run(id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function updateTaskDetails(input: {
  id: string;
  title: string;
  dueDate: string;
  notes: string | null;
}): void {
  if (!input.dueDate) throw new Error("Teslim tarihi zorunlu.");
  getDb()
    .prepare(
      "UPDATE tasks SET title = ?, due_date = ?, notes = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .run(input.title, input.dueDate, input.notes, input.id);
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
  getDb()
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
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => "?").join(", ");
  const tasks = plainList<TaskStatusRow>(
    getDb()
      .prepare(`SELECT id, status FROM tasks WHERE id IN (${placeholders})`)
      .all(...ids),
  );
  return applyTaskStatusChanges(tasks, status, actorId);
}

export function bulkUpdateTaskPriority(ids: string[], priority: TaskPriority): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(", ");
  getDb()
    .prepare(
      `UPDATE tasks SET priority = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`,
    )
    .run(priority, ...ids);
}

export function bulkUpdateTaskAssignee(ids: string[], assigneeId: string | null): void {
  if (ids.length === 0) return;
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
      return;
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
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function bulkDeleteTasks(ids: string[]): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(", ");
  getDb().prepare(`DELETE FROM tasks WHERE id IN (${placeholders})`).run(...ids);
}
