import { getDb, plainList, plainOne } from "@/lib/db/client";
import type { GuestTaskDTO, SharedTaskAttachment, SharedTaskComment, TaskStatus } from "@/lib/types";

interface GuestTaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  requested_date: string;
  brief: string;
  content_title: string;
  content_type: GuestTaskDTO["content_type"];
  brand_id: string;
  brand_name: string;
  created_at: string;
  updated_at: string;
}

const GUEST_TASK_SELECT = `
  SELECT t.id, t.title, t.status, t.requested_date,
         COALESCE(t.guest_brief, '') AS brief,
         ci.title AS content_title, ci.type AS content_type,
         b.id AS brand_id, b.name AS brand_name,
         t.created_at, t.updated_at
    FROM tasks t
    JOIN content_items ci ON ci.id = t.content_item_id
    JOIN brands b ON b.id = ci.brand_id
`;

export function listSharedComments(taskId: string): SharedTaskComment[] {
  return plainList<SharedTaskComment>(getDb().prepare(
    `SELECT c.id, c.task_id, c.account_id, c.author_name,
            c.body, c.created_at, c.updated_at
       FROM task_shared_comments c
      WHERE c.task_id = ?
      ORDER BY c.created_at, c.rowid`,
  ).all(taskId));
}

export function listSharedAttachments(taskId: string): SharedTaskAttachment[] {
  return plainList<SharedTaskAttachment>(getDb().prepare(
    `SELECT id, task_id, account_id, file_path, original_name, created_at
       FROM task_shared_attachments WHERE task_id = ? ORDER BY created_at, rowid`,
  ).all(taskId));
}

function toDto(row: GuestTaskRow): GuestTaskDTO {
  return {
    ...row,
    editable: row.status === "Beklemede",
    comments: listSharedComments(row.id),
    attachments: listSharedAttachments(row.id),
  };
}

export function listGuestTasks(brandId: string): GuestTaskDTO[] {
  return plainList<GuestTaskRow>(getDb().prepare(
    `${GUEST_TASK_SELECT}
      WHERE t.origin = 'guest' AND b.id = ?
      ORDER BY CASE WHEN t.due_date IS NULL THEN 0 ELSE 1 END, t.requested_date, t.created_at DESC`,
  ).all(brandId)).map(toDto);
}

export function getGuestTask(taskId: string, brandId: string): GuestTaskDTO | undefined {
  const row = plainOne<GuestTaskRow>(getDb().prepare(
    `${GUEST_TASK_SELECT} WHERE t.id = ? AND t.origin = 'guest' AND b.id = ?`,
  ).get(taskId, brandId));
  return row ? toDto(row) : undefined;
}

export function createGuestTask(input: {
  brandId: string;
  accountId: string;
  title: string;
  brief: string;
  requestedDate: string;
  attachments: Array<{ filePath: string; originalName: string | null }>;
}): string {
  const db = getDb();
  const contentId = crypto.randomUUID();
  const taskId = crypto.randomUUID();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      `INSERT INTO content_items (id, brand_id, title, type, target_date, status)
       VALUES (?, ?, ?, 'Diger', NULL, 'Planlandi')`,
    ).run(contentId, input.brandId, `Guest · ${input.title}`);
    db.prepare(
      `INSERT INTO tasks
         (id, content_item_id, title, status, priority, assignee_id, due_date,
          weight_points, origin, requested_date, guest_brief, created_by_account_id)
       VALUES (?, ?, ?, 'Beklemede', 'Normal', NULL, NULL, 1, 'guest', ?, ?, ?)`,
    ).run(taskId, contentId, input.title, input.requestedDate, input.brief, input.accountId);
    const insertAttachment = db.prepare(
      `INSERT INTO task_shared_attachments (id, task_id, account_id, file_path, original_name)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const attachment of input.attachments) {
      insertAttachment.run(crypto.randomUUID(), taskId, input.accountId, attachment.filePath, attachment.originalName);
    }
    db.exec("COMMIT");
    return taskId;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function updateGuestTask(input: {
  taskId: string;
  brandId: string;
  title: string;
  brief: string;
  requestedDate: string;
}): boolean {
  const result = getDb().prepare(
    `UPDATE tasks
        SET title = ?, guest_brief = ?, requested_date = ?, updated_at = datetime('now')
      WHERE id = ? AND origin = 'guest' AND status = 'Beklemede'
        AND content_item_id IN (SELECT id FROM content_items WHERE brand_id = ?)`,
  ).run(input.title, input.brief, input.requestedDate, input.taskId, input.brandId);
  return result.changes === 1;
}

export function addSharedComment(input: { taskId: string; accountId: string; authorName: string; body: string }): string {
  const id = crypto.randomUUID();
  getDb().prepare(
    `INSERT INTO task_shared_comments (id, task_id, account_id, author_name, body) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, input.taskId, input.accountId, input.authorName, input.body);
  return id;
}

export function addSharedAttachments(input: {
  taskId: string;
  accountId: string;
  attachments: Array<{ filePath: string; originalName: string | null }>;
}): void {
  const insert = getDb().prepare(
    `INSERT INTO task_shared_attachments (id, task_id, account_id, file_path, original_name)
     VALUES (?, ?, ?, ?, ?)`,
  );
  for (const attachment of input.attachments) {
    insert.run(crypto.randomUUID(), input.taskId, input.accountId, attachment.filePath, attachment.originalName);
  }
}

export function getSharedAttachment(id: string, taskId: string): SharedTaskAttachment | undefined {
  return plainOne<SharedTaskAttachment>(getDb().prepare(
    `SELECT id, task_id, account_id, file_path, original_name, created_at
       FROM task_shared_attachments WHERE id = ? AND task_id = ?`,
  ).get(id, taskId));
}

export function deleteSharedAttachment(id: string, taskId: string): void {
  getDb().prepare("DELETE FROM task_shared_attachments WHERE id = ? AND task_id = ?").run(id, taskId);
}

export function guestCanAccessUpload(accountBrandId: string, filePath: string): boolean {
  return Boolean(getDb().prepare(
    `SELECT 1
       FROM task_shared_attachments a
       JOIN tasks t ON t.id = a.task_id
       JOIN content_items ci ON ci.id = t.content_item_id
      WHERE ci.brand_id = ? AND a.file_path = ?`,
  ).get(accountBrandId, filePath));
}

export function listUnplannedGuestTasks(): Array<{ id: string; title: string; requested_date: string; brand_name: string; created_at: string }> {
  return plainList(getDb().prepare(
    `SELECT t.id, t.title, t.requested_date, b.name AS brand_name, t.created_at
       FROM tasks t JOIN content_items ci ON ci.id = t.content_item_id JOIN brands b ON b.id = ci.brand_id
      WHERE t.origin = 'guest' AND t.due_date IS NULL
      ORDER BY t.requested_date, t.created_at`,
  ).all());
}

export function listLegacyUndatedTasks(): Array<{ id: string; title: string; brand_name: string; created_at: string }> {
  return plainList(getDb().prepare(
    `SELECT t.id, t.title, b.name AS brand_name, t.created_at
       FROM tasks t JOIN content_items ci ON ci.id = t.content_item_id JOIN brands b ON b.id = ci.brand_id
      WHERE t.origin = 'team' AND t.due_date IS NULL
      ORDER BY t.created_at`,
  ).all());
}
