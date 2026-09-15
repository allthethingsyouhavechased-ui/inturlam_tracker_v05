import { getDb, plainList } from "@/lib/db/client";
import { TaskTransitionError } from "@/lib/taskLifecycle";
import type { CustomerApprovalChannel, TaskCustomerApproval } from "@/lib/types";

export function listTaskCustomerApprovals(taskId: string): TaskCustomerApproval[] {
  return plainList<TaskCustomerApproval>(
    getDb()
      .prepare(
        `SELECT a.*, d.version_number AS delivery_version
           FROM task_customer_approvals a
           LEFT JOIN task_deliveries d ON d.id = a.delivery_id
          WHERE a.task_id = ?
          ORDER BY a.approved_at DESC, a.created_at DESC`,
      )
      .all(taskId),
  );
}

/**
 * Müşteri onayını KAYDEDER. Onayı müşteri portalı değil, yetkili ekip üyesi
 * dışarıdan gelen bilgiye dayanarak giriyor — bu yüzden onayı VEREN müşteri
 * adı ile KAYDEDEN ekip üyesi ayrı alanlarda.
 *
 * Onay her zaman görevin SON teslim sürümüne bağlanır: yeni bir teslim
 * geldiğinde eski sürümün onayı geçersizleşir (bkz. invalidateCustomerApprovals),
 * böylece "onaylanmış" bir görev sessizce yeni bir sürümle yayınlanamaz.
 */
export function recordCustomerApproval(input: {
  taskId: string;
  customerName: string;
  channel: CustomerApprovalChannel;
  referenceUrl: string | null;
  note: string | null;
  approvedAt: string | null;
  recordedById: string;
  recordedByName: string;
}): TaskCustomerApproval {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const task = db
      .prepare("SELECT status, archived_at, customer_approval_required FROM tasks WHERE id = ?")
      .get(input.taskId) as
      | { status: string; archived_at: string | null; customer_approval_required: number }
      | undefined;
    if (!task) throw new TaskTransitionError("Görev bulunamadı.");
    if (task.archived_at !== null) {
      throw new TaskTransitionError("Arşivlenmiş göreve müşteri onayı kaydedilemez.");
    }
    if (task.customer_approval_required !== 1) {
      throw new TaskTransitionError("Bu görevde müşteri onayı gerekmiyor.");
    }
    const latest = db
      .prepare(
        "SELECT id, status FROM task_deliveries WHERE task_id = ? ORDER BY version_number DESC LIMIT 1",
      )
      .get(input.taskId) as { id: string; status: string } | undefined;
    if (!latest) throw new TaskTransitionError("Müşteri onayı için önce bir teslim sürümü gerekli.");
    if (latest.status !== "Onaylandi") {
      throw new TaskTransitionError("Müşteri onayı kaydedilmeden önce teslim ekipçe onaylanmalı.");
    }
    if (
      db.prepare(
        `SELECT 1 FROM task_customer_approvals
          WHERE task_id = ? AND delivery_id = ? AND invalidated_at IS NULL`,
      ).get(input.taskId, latest.id)
    ) {
      throw new TaskTransitionError("Bu teslim sürümü için müşteri onayı zaten kayıtlı.");
    }

    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO task_customer_approvals
         (id, task_id, delivery_id, customer_name, channel, reference_url, note,
          recorded_by_id, recorded_by_name, approved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`,
    ).run(
      id,
      input.taskId,
      latest.id,
      input.customerName,
      input.channel,
      input.referenceUrl,
      input.note,
      input.recordedById,
      input.recordedByName,
      input.approvedAt,
    );
    db.exec("COMMIT");
    return listTaskCustomerApprovals(input.taskId).find((row) => row.id === id)!;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Yeni bir teslim sürümü gelince eski sürümün onayını geçersizleştirir.
 * Kayıt SİLİNMEZ; "ne zaman geçersizleşti" damgalanır — onay geçmişi raporda
 * ve görev geçmişinde okunabilir kalsın.
 */
export function invalidateCustomerApprovals(taskId: string, exceptDeliveryId: string | null = null): number {
  const db = getDb();
  const result = exceptDeliveryId
    ? db.prepare(
        `UPDATE task_customer_approvals SET invalidated_at = datetime('now')
          WHERE task_id = ? AND invalidated_at IS NULL AND (delivery_id IS NULL OR delivery_id <> ?)`,
      ).run(taskId, exceptDeliveryId)
    : db.prepare(
        `UPDATE task_customer_approvals SET invalidated_at = datetime('now')
          WHERE task_id = ? AND invalidated_at IS NULL`,
      ).run(taskId);
  return Number(result.changes);
}
