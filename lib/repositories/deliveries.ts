import { assertTaskTransition, TaskTransitionError } from "@/lib/taskLifecycle";
import { isTaskShared, TASK_SHARED_SQL } from "@/lib/taskSharing";
import type { DatabaseSync } from "node:sqlite";
import { getDb, plainList, plainOne } from "@/lib/db/client";
import type {
  AccountKind,
  GuestTaskDelivery,
  TaskDelivery,
  TaskDeliveryAttachment,
  TaskDeliveryStatus,
  TaskRevisionReason,
  TaskStatus,
} from "@/lib/types";

type DeliveryRow = Omit<TaskDelivery, "attachments">;

interface DeliveryTaskRow {
  id: string;
  task_id: string;
  status: TaskDeliveryStatus;
  guest_visible: number;
  task_status: TaskStatus;
  archived_at: string | null;
  due_date: string | null;
  origin: "team" | "guest";
  brand_id: string;
}

function attachmentsForDeliveries(deliveryIds: string[]): Map<string, TaskDeliveryAttachment[]> {
  const grouped = new Map<string, TaskDeliveryAttachment[]>();
  if (deliveryIds.length === 0) return grouped;
  const placeholders = deliveryIds.map(() => "?").join(", ");
  const rows = plainList<TaskDeliveryAttachment>(getDb().prepare(
    `SELECT * FROM task_delivery_attachments
      WHERE delivery_id IN (${placeholders})
      ORDER BY created_at, rowid`,
  ).all(...deliveryIds));
  for (const row of rows) grouped.set(row.delivery_id, [...(grouped.get(row.delivery_id) ?? []), row]);
  return grouped;
}

function hydrate(rows: DeliveryRow[]): TaskDelivery[] {
  const attachments = attachmentsForDeliveries(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, attachments: attachments.get(row.id) ?? [] }));
}

export function listTaskDeliveries(taskId: string): TaskDelivery[] {
  return hydrate(plainList<DeliveryRow>(getDb().prepare(
    `SELECT * FROM task_deliveries WHERE task_id = ? ORDER BY version_number DESC`,
  ).all(taskId)));
}

export function listGuestTaskDeliveries(taskId: string, brandId: string): GuestTaskDelivery[] {
  const rows = hydrate(plainList<DeliveryRow>(getDb().prepare(
    `SELECT d.*
       FROM task_deliveries d
       JOIN tasks t ON t.id = d.task_id
       JOIN content_items ci ON ci.id = t.content_item_id
      WHERE d.task_id = ? AND d.guest_visible = 1
        AND ${TASK_SHARED_SQL} AND ci.brand_id = ?
      ORDER BY d.version_number DESC`,
  ).all(taskId, brandId)));
  return rows.map((delivery) => ({
    id: delivery.id,
    version_number: delivery.version_number,
    note: delivery.note,
    external_url: delivery.external_url,
    status: delivery.status,
    submitted_by_name: delivery.submitted_by_name,
    submitted_at: delivery.submitted_at,
    decided_by_name: delivery.decided_by_name,
    decision_note: delivery.decision_note,
    revision_reason: delivery.revision_reason,
    decided_at: delivery.decided_at,
    attachments: delivery.attachments.map((attachment) => ({
      id: attachment.id,
      file_path: attachment.file_path,
      original_name: attachment.original_name,
      created_at: attachment.created_at,
    })),
  }));
}

function writeTaskStatus(
  db: DatabaseSync,
  taskId: string,
  fromStatus: TaskStatus,
  toStatus: TaskStatus,
  actorId: string | null,
): void {
  if (fromStatus === toStatus) {
    db.prepare("UPDATE tasks SET updated_at = datetime('now') WHERE id = ?").run(taskId);
    return;
  }
  db.prepare(
    `UPDATE tasks SET status = ?, completed_at = NULL, completed_by = NULL,
       archived_at = NULL, updated_at = datetime('now') WHERE id = ?`,
  ).run(toStatus, taskId);
  db.prepare(
    `INSERT INTO task_status_events (id, task_id, from_status, to_status, actor_id)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(crypto.randomUUID(), taskId, fromStatus, toStatus, actorId);
}

export function createTaskDelivery(
  input: {
    taskId: string;
    note: string | null;
    externalUrl: string | null;
    guestVisible: boolean;
    submittedByAccountId: string;
    submittedByName: string;
    submittedByPersonId: string;
  },
  attachments: Array<{ filePath: string; originalName: string | null }> = [],
): TaskDelivery {
  if (!input.note && !input.externalUrl && attachments.length === 0) {
    throw new Error("Teslim için not, bağlantı veya en az bir önizleme görseli gerekli.");
  }
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const task = db.prepare(
      `SELECT status, archived_at, due_date, origin FROM tasks WHERE id = ?`,
    ).get(input.taskId) as {
      status: TaskStatus;
      archived_at: string | null;
      due_date: string | null;
      origin: "team" | "guest";
    } | undefined;
    if (!task) throw new Error("Görev bulunamadı.");
    if (task.archived_at !== null || task.status === "Yayinlandi") {
      throw new Error("Yayınlanmış veya arşivlenmiş göreve yeni teslim eklenemez.");
    }
    if (!task.due_date) throw new Error("Teslim göndermeden önce iç teslim tarihi planlanmalı.");
    if (input.guestVisible && !isTaskShared(input.taskId)) {
      throw new Error("Teslim paylaşmadan önce müşteri erişimini açın.");
    }
    if (db.prepare(
      "SELECT 1 FROM task_deliveries WHERE task_id = ? AND status = 'Beklemede'",
    ).get(input.taskId)) {
      throw new Error("Bu görevde zaten karar bekleyen bir teslim var.");
    }

    const next = db.prepare(
      "SELECT COALESCE(MAX(version_number), 0) + 1 AS n FROM task_deliveries WHERE task_id = ?",
    ).get(input.taskId) as { n: number };
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO task_deliveries
         (id, task_id, version_number, note, external_url, guest_visible,
          submitted_by_account_id, submitted_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.taskId,
      next.n,
      input.note,
      input.externalUrl,
      input.guestVisible ? 1 : 0,
      input.submittedByAccountId,
      input.submittedByName,
    );
    const insertAttachment = db.prepare(
      `INSERT INTO task_delivery_attachments
         (id, delivery_id, file_path, original_name) VALUES (?, ?, ?, ?)`,
    );
    for (const attachment of attachments) {
      insertAttachment.run(crypto.randomUUID(), id, attachment.filePath, attachment.originalName);
    }

    db.prepare(
      `UPDATE task_revision_rounds
          SET completed_at = datetime('now'), completed_by = ?, updated_at = datetime('now')
        WHERE task_id = ? AND completed_at IS NULL`,
    ).run(input.submittedByPersonId, input.taskId);
    // Yeni sürüm eski sürümün ONAYLARINI geçersiz kılar: "onaylanmış" bir görev
    // sessizce başka bir sürümle yayınlanamasın. Kayıt silinmiyor, damgalanıyor.
    db.prepare(
      `UPDATE task_customer_approvals SET invalidated_at = datetime('now')
        WHERE task_id = ? AND invalidated_at IS NULL`,
    ).run(input.taskId);
    // Aktif revize kapanır ve iş EKİP incelemesine döner — müşteri aşamasına
    // değil: yeni sürümü önce ekip görür.
    writeTaskStatus(db, input.taskId, task.status, "Incelemede", input.submittedByPersonId);
    db.exec("COMMIT");
    return listTaskDeliveries(input.taskId).find((delivery) => delivery.id === id)!;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function decideTaskDelivery(input: {
  deliveryId: string;
  decision: Exclude<TaskDeliveryStatus, "Beklemede">;
  actorKind: AccountKind;
  actorAccountId: string;
  actorName: string;
  actorPersonId: string | null;
  brandId?: string;
  decisionNote: string | null;
  revisionReason: TaskRevisionReason | null;
  revisionTargetMinutes: number | null;
}): TaskDelivery {
  if (input.decision === "RevizeIstendi") {
    if (!input.decisionNote) throw new Error("Revize açıklaması zorunlu.");
    if (!input.revisionReason) throw new Error("Revize nedeni seçilmeli.");
    if (
      !Number.isInteger(input.revisionTargetMinutes) ||
      (input.revisionTargetMinutes ?? 0) < 15 ||
      (input.revisionTargetMinutes ?? 0) > 10080
    ) {
      throw new Error("Revize hedef süresi 15 dakika ile 7 gün arasında olmalı.");
    }
  }

  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db.prepare(
      `SELECT d.id, d.task_id, d.status, d.guest_visible,
              t.status AS task_status, t.archived_at, t.due_date, t.origin,
              ci.brand_id
         FROM task_deliveries d
         JOIN tasks t ON t.id = d.task_id
         JOIN content_items ci ON ci.id = t.content_item_id
        WHERE d.id = ?`,
    ).get(input.deliveryId) as DeliveryTaskRow | undefined;
    if (!row) throw new Error("Teslim bulunamadı.");
    const account = db.prepare("SELECT kind, person_id, brand_id, active FROM accounts WHERE id = ?").get(input.actorAccountId) as { kind: string; person_id: string | null; brand_id: string | null; active: number } | undefined;
    if (!account || account.active !== 1 || account.kind !== input.actorKind) throw new TaskTransitionError("Bu teslim için karar verme yetkiniz yok.");
    if (input.actorKind === "team") {
      if (!input.actorPersonId || account.person_id !== input.actorPersonId || !db.prepare("SELECT 1 FROM people WHERE id = ? AND active = 1 AND is_manager = 1").get(input.actorPersonId)) {
        throw new TaskTransitionError("Teslim kararını yalnızca yöneticiler verebilir.");
      }
    }
    if (input.actorKind === "guest") {
      if (account.brand_id !== input.brandId || input.actorPersonId !== null) throw new TaskTransitionError("Bu teslim için karar verme yetkiniz yok.");
      if (!input.brandId || row.brand_id !== input.brandId || !isTaskShared(row.task_id, input.brandId) || row.guest_visible !== 1) {
        throw new Error("Bu teslim için karar verme yetkiniz yok.");
      }
    }
    if (row.status !== "Beklemede") throw new Error("Bu teslim için daha önce karar verilmiş.");
    if (row.archived_at !== null || row.task_status === "Yayinlandi") {
      throw new Error("Yayınlanmış veya arşivlenmiş görevde teslim kararı değiştirilemez.");
    }

    // Revize kararı işi kendi sütununa ("Revizede") taşır; eskiden "Devam
    // Ediyor"a düşüyordu ve panoda normal üretimle aynı kovada görünüyordu.
    const nextStatus: TaskStatus = input.decision === "Onaylandi" ? "Onaylandi" : "Revizede";
    db.prepare(
      `UPDATE task_deliveries
          SET status = ?, decision_actor_kind = ?, decided_by_account_id = ?,
              decided_by_name = ?, decision_note = ?, revision_reason = ?,
              decided_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ? AND status = 'Beklemede'`,
    ).run(
      input.decision,
      input.actorKind,
      input.actorAccountId,
      input.actorName,
      input.decisionNote,
      input.decision === "RevizeIstendi" ? input.revisionReason : null,
      input.deliveryId,
    );

    if (input.decision === "RevizeIstendi") {
      if (db.prepare(
        "SELECT 1 FROM task_revision_rounds WHERE task_id = ? AND completed_at IS NULL",
      ).get(row.task_id)) {
        throw new Error("Bu görevde zaten aktif bir revize turu var.");
      }
      const next = db.prepare(
        "SELECT COALESCE(MAX(round_number), 0) + 1 AS n FROM task_revision_rounds WHERE task_id = ?",
      ).get(row.task_id) as { n: number };
      db.prepare(
        `INSERT INTO task_revision_rounds
           (id, task_id, round_number, target_minutes, note, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        crypto.randomUUID(),
        row.task_id,
        next.n,
        input.revisionTargetMinutes,
        input.decisionNote,
        input.actorPersonId,
      );
    }
    assertTaskTransition(db, { id: row.task_id, origin: row.origin, due_date: row.due_date }, nextStatus, input.actorPersonId, true);
    writeTaskStatus(
      db,
      row.task_id,
      row.task_status,
      nextStatus,
      input.actorPersonId ?? input.actorAccountId,
    );
    db.exec("COMMIT");
    return listTaskDeliveries(row.task_id).find((delivery) => delivery.id === input.deliveryId)!;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function getTaskIdForDelivery(deliveryId: string): string | undefined {
  return plainOne<{ task_id: string }>(
    getDb().prepare("SELECT task_id FROM task_deliveries WHERE id = ?").get(deliveryId),
  )?.task_id;
}
