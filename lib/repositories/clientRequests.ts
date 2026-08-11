import { getDb, plainList, plainOne } from "@/lib/db/client";
import type { DepartmentId } from "@/lib/departments";
import type {
  ClientRequest,
  ClientRequestComment,
  ContentType,
  TaskPriority,
} from "@/lib/types";

export interface ClientRequestWithContext extends ClientRequest {
  brand_name: string;
  created_by_name: string;
  assignee_name: string | null;
  reviewed_by_name: string | null;
  comment_count: number;
}

export interface ClientRequestCommentWithAuthor extends ClientRequestComment {
  author_name: string;
  author_avatar_path: string | null;
}

const REQUEST_WITH_CONTEXT_SELECT = `
  SELECT r.*,
         b.name AS brand_name,
         creator.name AS created_by_name,
         assignee.name AS assignee_name,
         reviewer.name AS reviewed_by_name,
         (SELECT COUNT(*) FROM client_request_comments rc WHERE rc.request_id = r.id)
           AS comment_count
  FROM client_requests r
  JOIN brands b ON b.id = r.brand_id
  JOIN people creator ON creator.id = r.created_by_id
  LEFT JOIN people assignee ON assignee.id = r.assignee_id
  LEFT JOIN people reviewer ON reviewer.id = r.reviewed_by_id
`;

export function createClientRequest(input: {
  brandId: string;
  title: string;
  description: string;
  requestedByName: string | null;
  source: string | null;
  referenceUrl: string | null;
  department: DepartmentId;
  contentType: ContentType;
  dueDate: string | null;
  createdById: string;
}): string {
  const id = crypto.randomUUID();
  getDb()
    .prepare(
      `INSERT INTO client_requests
         (id, brand_id, title, description, requested_by_name, source,
          reference_url, department, content_type, due_date, created_by_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.brandId,
      input.title,
      input.description,
      input.requestedByName,
      input.source,
      input.referenceUrl,
      input.department,
      input.contentType,
      input.dueDate,
      input.createdById,
    );
  return id;
}

export function listClientRequestsForPerson(
  personId: string,
  canReview: boolean,
): ClientRequestWithContext[] {
  const where = canReview ? "" : "WHERE r.created_by_id = ?";
  const args = canReview ? [] : [personId];
  return plainList<ClientRequestWithContext>(
    getDb()
      .prepare(
        `${REQUEST_WITH_CONTEXT_SELECT}
         ${where}
         ORDER BY
           CASE r.status
             WHEN 'Beklemede' THEN 0
             WHEN 'Incelemede' THEN 1
             WHEN 'Onaylandi' THEN 2
             ELSE 3
           END,
           r.updated_at DESC,
           r.rowid DESC`,
      )
      .all(...args),
  );
}

export function countOpenClientRequests(): number {
  return (
    plainOne<{ count: number }>(
      getDb()
        .prepare(
          `SELECT COUNT(*) AS count FROM client_requests
           WHERE status IN ('Beklemede', 'Incelemede')`,
        )
        .get(),
    )?.count ?? 0
  );
}

export function getClientRequest(id: string): ClientRequestWithContext | undefined {
  return plainOne<ClientRequestWithContext>(
    getDb().prepare(`${REQUEST_WITH_CONTEXT_SELECT} WHERE r.id = ?`).get(id),
  );
}

export function getClientRequestByTask(
  taskId: string,
): ClientRequestWithContext | undefined {
  return plainOne<ClientRequestWithContext>(
    getDb()
      .prepare(`${REQUEST_WITH_CONTEXT_SELECT} WHERE r.converted_task_id = ?`)
      .get(taskId),
  );
}

export function listClientRequestComments(
  requestId: string,
): ClientRequestCommentWithAuthor[] {
  return plainList<ClientRequestCommentWithAuthor>(
    getDb()
      .prepare(
        `SELECT c.*, p.name AS author_name, p.avatar_path AS author_avatar_path
         FROM client_request_comments c
         JOIN people p ON p.id = c.author_id
         WHERE c.request_id = ?
         ORDER BY c.created_at, c.rowid`,
      )
      .all(requestId),
  );
}

export function addClientRequestComment(input: {
  requestId: string;
  authorId: string;
  body: string;
}): string {
  const id = crypto.randomUUID();
  getDb()
    .prepare(
      `INSERT INTO client_request_comments (id, request_id, author_id, body)
       VALUES (?, ?, ?, ?)`,
    )
    .run(id, input.requestId, input.authorId, input.body);
  return id;
}

function ensureAssignable(assigneeId: string, department: DepartmentId): void {
  const assignee = plainOne<{ department: string | null; active: number }>(
    getDb()
      .prepare("SELECT department, active FROM people WHERE id = ?")
      .get(assigneeId),
  );
  if (!assignee || assignee.active !== 1) {
    throw new Error("Atanacak aktif ekip üyesi bulunamadı.");
  }
  if (assignee.department !== department) {
    throw new Error("Atanan kişi hedef departmanda değil.");
  }
}

export interface ClientRequestReviewInput {
  id: string;
  reviewerId: string;
  department: DepartmentId;
  assigneeId: string;
  priority: TaskPriority;
  dueDate: string | null;
}

export function updateClientRequestReview(input: ClientRequestReviewInput): void {
  ensureAssignable(input.assigneeId, input.department);
  const result = getDb()
    .prepare(
      `UPDATE client_requests
       SET department = ?, assignee_id = ?, priority = ?, due_date = ?,
           status = 'Incelemede', reviewed_by_id = ?, reviewed_at = datetime('now'),
           updated_at = datetime('now')
       WHERE id = ? AND status IN ('Beklemede', 'Incelemede')
         AND converted_task_id IS NULL`,
    )
    .run(
      input.department,
      input.assigneeId,
      input.priority,
      input.dueDate,
      input.reviewerId,
      input.id,
    );
  if (result.changes !== 1) {
    throw new Error("Bu talep artık değerlendirilemez.");
  }
}

function taskNotes(request: ClientRequest): string {
  const sections = [
    request.description,
    request.requested_by_name ? `Talebi ileten: ${request.requested_by_name}` : null,
    request.source ? `Kanal: ${request.source}` : null,
    request.reference_url ? `Referans: ${request.reference_url}` : null,
  ].filter(Boolean);
  return sections.join("\n\n");
}

export function approveClientRequest(
  input: ClientRequestReviewInput,
): { taskId: string; contentItemId: string } {
  const db = getDb();
  ensureAssignable(input.assigneeId, input.department);
  db.exec("BEGIN IMMEDIATE");
  try {
    const request = plainOne<ClientRequest>(
      db.prepare("SELECT * FROM client_requests WHERE id = ?").get(input.id),
    );
    if (!request) throw new Error("Talep bulunamadı.");
    if (request.converted_task_id || request.status === "Onaylandi") {
      throw new Error("Bu talep zaten onaylanmış.");
    }
    if (request.status === "Reddedildi") {
      throw new Error("Reddedilmiş talep onaylanamaz.");
    }

    const contentItemId = crypto.randomUUID();
    const taskId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO content_items
         (id, brand_id, title, type, target_date, assignee_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      contentItemId,
      request.brand_id,
      `Talep · ${request.title}`,
      request.content_type,
      input.dueDate,
      input.assigneeId,
    );
    db.prepare(
      `INSERT INTO tasks
         (id, content_item_id, title, priority, assignee_id, due_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      taskId,
      contentItemId,
      request.title,
      input.priority,
      input.assigneeId,
      input.dueDate,
      taskNotes(request),
    );
    db.prepare(
      `UPDATE client_requests
       SET department = ?, assignee_id = ?, priority = ?, due_date = ?,
           status = 'Onaylandi', reviewed_by_id = ?, reviewed_at = datetime('now'),
           converted_task_id = ?, updated_at = datetime('now')
       WHERE id = ?`,
    ).run(
      input.department,
      input.assigneeId,
      input.priority,
      input.dueDate,
      input.reviewerId,
      taskId,
      input.id,
    );
    db.exec("COMMIT");
    return { taskId, contentItemId };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function rejectClientRequest(input: {
  id: string;
  reviewerId: string;
  reason: string;
}): void {
  const reason = input.reason.trim();
  if (!reason) throw new Error("Ret gerekçesi zorunlu.");
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = db
      .prepare(
        `UPDATE client_requests
         SET status = 'Reddedildi', reviewed_by_id = ?, reviewed_at = datetime('now'),
             updated_at = datetime('now')
         WHERE id = ? AND status IN ('Beklemede', 'Incelemede')
           AND converted_task_id IS NULL`,
      )
      .run(input.reviewerId, input.id);
    if (result.changes !== 1) throw new Error("Bu talep artık reddedilemez.");
    db.prepare(
      `INSERT INTO client_request_comments (id, request_id, author_id, body)
       VALUES (?, ?, ?, ?)`,
    ).run(crypto.randomUUID(), input.id, input.reviewerId, reason);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
