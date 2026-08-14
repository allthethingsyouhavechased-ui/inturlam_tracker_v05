import { getDb, plainList, plainOne } from "@/lib/db/client";
import type { ContentItem, ContentStatus, ContentType } from "@/lib/types";
import { plannedTaskCondition, visibleContentCondition } from "@/lib/taskPlanning";

export interface ContentItemWithCounts extends ContentItem {
  task_total: number;
  task_open: number;
  assignee_name: string | null;
}

export function listContentByBrand(brandId: string): ContentItemWithCounts[] {
  return plainList<ContentItemWithCounts>(
    getDb()
      .prepare(
        `SELECT ci.*, p.name AS assignee_name,
                COUNT(t.id) AS task_total,
                COALESCE(SUM(CASE WHEN t.status != 'Yayinlandi' THEN 1 ELSE 0 END), 0) AS task_open
         FROM content_items ci
         LEFT JOIN people p ON p.id = ci.assignee_id
         LEFT JOIN tasks t ON t.content_item_id = ci.id AND ${plannedTaskCondition("t")}
         WHERE ci.brand_id = ? AND ci.archived = 0 AND ${visibleContentCondition("ci")}
         GROUP BY ci.id
         ORDER BY (ci.target_date IS NULL), ci.target_date, ci.created_at DESC`,
      )
      .all(brandId),
  );
}

export function listArchivedContentByBrand(brandId: string): ContentItemWithCounts[] {
  return plainList<ContentItemWithCounts>(
    getDb()
      .prepare(
        `SELECT ci.*, p.name AS assignee_name,
                COUNT(t.id) AS task_total,
                COALESCE(SUM(CASE WHEN t.status != 'Yayinlandi' THEN 1 ELSE 0 END), 0) AS task_open
         FROM content_items ci
         LEFT JOIN people p ON p.id = ci.assignee_id
         LEFT JOIN tasks t ON t.content_item_id = ci.id
         WHERE ci.brand_id = ? AND ci.archived = 1
         GROUP BY ci.id
         ORDER BY ci.title`,
      )
      .all(brandId),
  );
}

export function setContentArchived(id: string, archived: boolean): boolean {
  const value = archived ? 1 : 0;
  const result = getDb()
    .prepare("UPDATE content_items SET archived = ?, updated_at = datetime('now') WHERE id = ?")
    .run(value, id);
  return Number(result.changes) === 1;
}

export interface ContentSummary {
  id: string;
  brand_id: string;
  title: string;
  type: ContentType;
  status: ContentStatus;
}

// Sidebar için: tüm markaların içeriklerini TEK sorguda getirir (19 marka için
// her biri ayrı sorgu atmak yerine) — çağıran taraf brand_id'ye göre grupluyor.
export function listAllContentSummaries(): ContentSummary[] {
  return plainList<ContentSummary>(
    getDb()
      .prepare(
        `SELECT ci.id, ci.brand_id, ci.title, ci.type, ci.status FROM content_items ci
          WHERE ci.archived = 0 AND ${visibleContentCondition("ci")}
          ORDER BY ci.created_at DESC`,
      )
      .all(),
  );
}

export interface ContentItemWithAssignee extends ContentItem {
  assignee_name: string | null;
}

export function getContentItem(id: string): ContentItemWithAssignee | undefined {
  return plainOne<ContentItemWithAssignee>(
    getDb()
      .prepare(
        `SELECT ci.*, p.name AS assignee_name
         FROM content_items ci
         LEFT JOIN people p ON p.id = ci.assignee_id
         WHERE ci.id = ?`,
      )
      .get(id),
  );
}

export function createContentItem(input: {
  brandId: string;
  title: string;
  type: ContentType;
  targetDate: string | null;
  assigneeId: string | null;
}): string {
  const id = crypto.randomUUID();
  getDb()
    .prepare(
      "INSERT INTO content_items (id, brand_id, title, type, target_date, assignee_id) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(id, input.brandId, input.title, input.type, input.targetDate, input.assigneeId);
  return id;
}

export function updateContentStatus(id: string, status: ContentStatus): boolean {
  const result = getDb()
    .prepare(
      "UPDATE content_items SET status = ?, updated_at = datetime('now') WHERE id = ? AND status <> ?",
    )
    .run(status, id, status);
  return Number(result.changes) === 1;
}

export function updateContentItem(input: {
  id: string;
  title: string;
  type: ContentType;
  targetDate: string | null;
  assigneeId: string | null;
}): boolean {
  const result = getDb()
    .prepare(
      `UPDATE content_items
       SET title = ?, type = ?, target_date = ?, assignee_id = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(input.title, input.type, input.targetDate, input.assigneeId, input.id);
  return Number(result.changes) === 1;
}

export function deleteContentItem(id: string): boolean {
  return Number(getDb().prepare("DELETE FROM content_items WHERE id = ?").run(id).changes) === 1;
}
