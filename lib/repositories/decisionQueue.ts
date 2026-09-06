import { getDb, plainList } from "@/lib/db/client";
import { plannedTaskCondition } from "@/lib/taskPlanning";

export interface DecisionQueueItem {
  task_id: string; title: string; brand_name: string; delivery_id: string; version_number: number;
}

// A decision belongs to the pending version, not to the task's assignee.
export function listPendingDecisions(personId: string): DecisionQueueItem[] {
  return plainList<DecisionQueueItem>(getDb().prepare(`
    SELECT t.id AS task_id, t.title, b.name AS brand_name,
           d.id AS delivery_id, d.version_number
      FROM task_deliveries d
      JOIN tasks t ON t.id = d.task_id
      JOIN content_items ci ON ci.id = t.content_item_id
      JOIN brands b ON b.id = ci.brand_id
     WHERE EXISTS (SELECT 1 FROM people WHERE id = ? AND is_manager = 1 AND active = 1)
       AND d.status = 'Beklemede' AND t.archived_at IS NULL
       AND ci.archived = 0 AND ci.status <> 'IptalEdildi'
       AND t.status <> 'Yayinlandi' AND ${plannedTaskCondition("t")}
       AND d.version_number = (SELECT MAX(latest.version_number) FROM task_deliveries latest WHERE latest.task_id = t.id)
     ORDER BY d.submitted_at, t.id
  `).all(personId));
}
