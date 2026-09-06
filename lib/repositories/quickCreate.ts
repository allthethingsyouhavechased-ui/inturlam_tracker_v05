import { createHash } from "node:crypto";
import { getDb } from "@/lib/db/client";
import { CONTENT_TYPES, TASK_DIFFICULTIES, TASK_PRIORITIES } from "@/lib/constants";
import { resolveTaskCreationWeight } from "@/lib/progress";
import { NEW_CONTENT_VALUE } from "@/lib/quickAdd";
import { QuickCreateValidationError, type QuickCreateField, type QuickCreateFieldErrors } from "@/lib/quickCreate";
import { createContentItem } from "@/lib/repositories/content";
import { createTask } from "@/lib/repositories/tasks";
import { insertActivity } from "@/lib/repositories/activity";
import type { ContentType, TaskDifficulty, TaskPriority } from "@/lib/types";

// The request receipt and both inserts share the same SQLite write transaction.
// Retain receipts after task deletion so a delayed retry cannot recreate deleted work.
export function quickCreateTask(actorId: string, formData: FormData) {
  const read = (name: string) => String(formData.get(name) ?? "").trim();
  const requestId = read("requestId");
  if (!/^[a-zA-Z0-9-]{16,100}$/.test(requestId)) {
    throw new QuickCreateValidationError({}, "İstek anahtarı geçersiz. Sayfayı yenileyip tekrar deneyin.");
  }
  const fields: QuickCreateField[] = ["brandId", "contentItemId", "newContentTitle", "title", "contentType", "priority", "difficulty", "weightPoints", "assigneeId", "dueDate"];
  const values = Object.fromEntries(fields.map((field) => [field, read(field)])) as Record<QuickCreateField, string>;
  const hash = createHash("sha256").update(JSON.stringify(values)).digest("hex");
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const actor = db.prepare("SELECT name, is_manager FROM people WHERE id = ? AND active = 1").get(actorId) as { name: string; is_manager: number } | undefined;
    if (!actor) throw new QuickCreateValidationError({}, "Aktif ekip hesabı gerekli.");
    const previous = db.prepare("SELECT payload_hash, task_id, content_item_id FROM quick_create_requests WHERE actor_id = ? AND request_id = ?").get(actorId, requestId) as { payload_hash: string; task_id: string; content_item_id: string } | undefined;
    if (previous) {
      if (previous.payload_hash !== hash) throw new QuickCreateValidationError({}, "Bu deneme daha önce kaydedildi. Sayfayı yenileyerek görevi kontrol edin.");
      if (!db.prepare("SELECT 1 FROM tasks WHERE id = ?").get(previous.task_id)) throw new QuickCreateValidationError({}, "Bu denemenin görevi daha sonra silinmiş. Sayfayı yenileyin.");
      db.exec("COMMIT");
      return { taskId: previous.task_id, contentItemId: previous.content_item_id };
    }
    const errors: QuickCreateFieldErrors = {};
    if (!values.title || values.title.length > 200) errors.title = "Görev başlığı 1–200 karakter olmalı.";
    if (values.newContentTitle.length > 200) errors.newContentTitle = "Çalışma başlığı en fazla 200 karakter olabilir.";
    if (!CONTENT_TYPES.includes(values.contentType as ContentType)) errors.contentType = "Görev türü seçin.";
    if (!TASK_PRIORITIES.includes(values.priority as TaskPriority)) errors.priority = "Geçerli bir öncelik seçin.";
    if (!TASK_DIFFICULTIES.includes(values.difficulty as TaskDifficulty)) errors.difficulty = "Zorluk derecesi seçin.";
    const date = new Date(`${values.dueDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.dueDate) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== values.dueDate) errors.dueDate = "Geçerli bir teslim tarihi seçin.";
    if (!db.prepare("SELECT 1 FROM brands WHERE id = ? AND archived = 0").get(values.brandId)) errors.brandId = "Marka bulunamadı veya arşivlenmiş. Listeyi yenileyin.";
    if (values.assigneeId && !db.prepare("SELECT 1 FROM people WHERE id = ? AND active = 1").get(values.assigneeId)) errors.assigneeId = "Sorumlu artık aktif değil. Başka bir kişi seçin.";
    if (values.contentItemId !== NEW_CONTENT_VALUE && !db.prepare("SELECT 1 FROM content_items WHERE id = ? AND brand_id = ? AND archived = 0 AND status <> 'IptalEdildi'").get(values.contentItemId, values.brandId)) errors.contentItemId = "Çalışma bulunamadı veya bu markaya ait değil. Başka bir çalışma seçin.";
    let weightPoints = 0;
    if (!errors.difficulty) {
      try { weightPoints = resolveTaskCreationWeight(values.weightPoints, actor.is_manager === 1, values.difficulty as TaskDifficulty); }
      catch (error) { errors.weightPoints = error instanceof Error ? error.message : "Puan geçersiz."; }
    }
    if (Object.keys(errors).length) throw new QuickCreateValidationError(errors);
    const contentItemId = values.contentItemId === NEW_CONTENT_VALUE
      ? createContentItem({ brandId: values.brandId, title: values.newContentTitle || values.title, type: values.contentType as ContentType, targetDate: null, assigneeId: null })
      : values.contentItemId;
    const taskId = createTask({ contentItemId, title: values.title, assigneeId: values.assigneeId || null,
      dueDate: values.dueDate, contentType: values.contentType as ContentType, priority: values.priority as TaskPriority,
      difficulty: values.difficulty as TaskDifficulty, weightPoints });
    db.prepare("INSERT INTO quick_create_requests(actor_id, request_id, payload_hash, task_id, content_item_id) VALUES(?,?,?,?,?)").run(actorId, requestId, hash, taskId, contentItemId);
    insertActivity({ actorId, actorName: actor.name, action: "task.create", entityType: "task", entityId: taskId, brandId: values.brandId, summary: `“${values.title}” görevini oluşturdu` });
    db.exec("COMMIT");
    return { taskId, contentItemId };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
