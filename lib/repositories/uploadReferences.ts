import { getDb, plainList } from "@/lib/db/client";

function uniquePaths(rows: Array<{ file_path: string }>): string[] {
  return Array.from(new Set(rows.map((row) => row.file_path))).sort();
}

export function listUploadPathsForTaskIds(taskIds: string[]): string[] {
  if (taskIds.length === 0) return [];
  const placeholders = taskIds.map(() => "?").join(", ");
  return uniquePaths(plainList<{ file_path: string }>(getDb().prepare(`
    SELECT file_path FROM task_attachments WHERE task_id IN (${placeholders})
    UNION
    SELECT ca.file_path FROM comment_attachments ca
      JOIN comments c ON c.id = ca.comment_id
     WHERE c.task_id IN (${placeholders})
    UNION
    SELECT file_path FROM task_shared_attachments WHERE task_id IN (${placeholders})
  `).all(...taskIds, ...taskIds, ...taskIds)));
}

export function listUploadPathsForContent(contentId: string): string[] {
  const taskIds = plainList<{ id: string }>(
    getDb().prepare("SELECT id FROM tasks WHERE content_item_id = ?").all(contentId),
  ).map((row) => row.id);
  return listUploadPathsForTaskIds(taskIds);
}

export function listUploadPathsForBrand(brandId: string): string[] {
  return uniquePaths(plainList<{ file_path: string }>(getDb().prepare(`
    SELECT ta.file_path FROM task_attachments ta
      JOIN tasks t ON t.id = ta.task_id
      JOIN content_items ci ON ci.id = t.content_item_id
     WHERE ci.brand_id = ?
    UNION
    SELECT ca.file_path FROM comment_attachments ca
      JOIN comments c ON c.id = ca.comment_id
      JOIN tasks t ON t.id = c.task_id
      JOIN content_items ci ON ci.id = t.content_item_id
     WHERE ci.brand_id = ?
    UNION
    SELECT sa.file_path FROM task_shared_attachments sa
      JOIN tasks t ON t.id = sa.task_id
      JOIN content_items ci ON ci.id = t.content_item_id
     WHERE ci.brand_id = ?
    UNION
    SELECT ra.file_path FROM client_request_attachments ra
      JOIN client_requests r ON r.id = ra.request_id
     WHERE r.brand_id = ?
  `).all(brandId, brandId, brandId, brandId)));
}
