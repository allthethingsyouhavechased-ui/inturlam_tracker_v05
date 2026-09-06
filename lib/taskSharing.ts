import { getDb } from "@/lib/db/client";

/** An explicit revoke overrides legacy guest-origin access. */
export const TASK_SHARED_SQL = "COALESCE((SELECT enabled FROM task_customer_sharing WHERE task_id = t.id), CASE WHEN t.origin = 'guest' THEN 1 ELSE 0 END) = 1";

export function isTaskShared(taskId: string, brandId?: string): boolean {
  return Boolean(getDb().prepare(`SELECT 1 FROM tasks t JOIN content_items ci ON ci.id=t.content_item_id WHERE t.id=? AND ${TASK_SHARED_SQL} AND (? IS NULL OR ci.brand_id=?)`).get(taskId, brandId ?? null, brandId ?? null));
}

export function setTaskSharing(input: { taskId: string; actorId: string; enabled: boolean; brief: string; requestedDate: string | null }): void {
  const db=getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    if (!db.prepare("SELECT 1 FROM people WHERE id=? AND active=1 AND is_manager=1").get(input.actorId)) throw new Error("Müşteri paylaşımını yalnızca yöneticiler yönetebilir.");
    if (!db.prepare("SELECT 1 FROM tasks WHERE id=?").get(input.taskId)) throw new Error("Görev bulunamadı.");
    if (input.brief.length>5000) throw new Error("Brief en fazla 5000 karakter olabilir.");
    if (input.requestedDate) {
      const d=new Date(`${input.requestedDate}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.requestedDate) || !Number.isFinite(d.getTime()) || d.toISOString().slice(0,10)!==input.requestedDate) throw new Error("Müşteri tarihi geçersiz.");
    }
    const before=isTaskShared(input.taskId);
    db.prepare("INSERT INTO task_customer_sharing (task_id,enabled,updated_by) VALUES (?,?,?) ON CONFLICT(task_id) DO UPDATE SET enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=datetime('now')").run(input.taskId,input.enabled?1:0,input.actorId);
    db.prepare("UPDATE tasks SET guest_brief=?,requested_date=?,updated_at=datetime('now') WHERE id=?").run(input.brief,input.requestedDate,input.taskId);
    db.prepare("INSERT INTO task_customer_sharing_events(id,task_id,actor_id,previous_enabled,enabled) VALUES (?,?,?,?,?)").run(crypto.randomUUID(),input.taskId,input.actorId,before?1:0,input.enabled?1:0);
    db.exec("COMMIT");
  } catch(error) { db.exec("ROLLBACK"); throw error; }
}
