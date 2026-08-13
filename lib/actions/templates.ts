"use server";

import { revalidatePath } from "next/cache";
import { recordActivity } from "@/lib/activity";
import { activeAssigneeId } from "@/lib/assignees";
import { CONTENT_TYPES, TASK_DIFFICULTIES, TASK_PRIORITIES } from "@/lib/constants";
import { requireManager, requireSession } from "@/lib/identity";
import { getContentItem } from "@/lib/repositories/content";
import {
  addTemplateItem,
  applyTemplateToContent,
  createTemplate,
  deleteTemplate,
  deleteTemplateItem,
  getTemplate,
  renameTemplate,
} from "@/lib/repositories/templates";
import type { ContentType, TaskDifficulty, TaskPriority } from "@/lib/types";

function readContentType(value: FormDataEntryValue | null): ContentType | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  if (!CONTENT_TYPES.includes(s as ContentType)) throw new Error("Geçersiz içerik türü.");
  return s as ContentType;
}

export async function createTemplateAction(formData: FormData): Promise<void> {
  await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Şablon adı zorunlu.");
  const contentType = readContentType(formData.get("contentType"));

  const id = createTemplate({ name, contentType });
  await recordActivity({
    action: "template.create",
    entityType: "template",
    entityId: id,
    summary: `“${name}” görev şablonunu oluşturdu`,
  });
  revalidatePath("/", "layout");
}

export async function renameTemplateAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) throw new Error("Şablon adı zorunlu.");
  if (!getTemplate(id)) throw new Error("Şablon bulunamadı.");
  const contentType = readContentType(formData.get("contentType"));

  renameTemplate(id, name, contentType);
  await recordActivity({
    action: "template.rename",
    entityType: "template",
    entityId: id,
    summary: `Şablonu “${name}” olarak güncelledi`,
  });
  revalidatePath("/", "layout");
}

export async function deleteTemplateAction(id: string): Promise<void> {
  await requireManager();
  const template = getTemplate(id);
  if (!template) throw new Error("Şablon bulunamadı.");

  deleteTemplate(id);
  await recordActivity({
    action: "template.delete",
    entityType: "template",
    entityId: id,
    summary: `“${template.name}” şablonunu sildi`,
  });
  revalidatePath("/", "layout");
}

export async function addTemplateItemAction(formData: FormData): Promise<void> {
  await requireSession();
  const templateId = String(formData.get("templateId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  if (!templateId || !title) throw new Error("Görev başlığı zorunlu.");
  if (!getTemplate(templateId)) throw new Error("Şablon bulunamadı.");

  const priority = String(formData.get("priority") ?? "Normal") as TaskPriority;
  if (!TASK_PRIORITIES.includes(priority)) throw new Error("Geçersiz öncelik.");
  const difficulty = String(formData.get("difficulty") ?? "Orta") as TaskDifficulty;
  if (!TASK_DIFFICULTIES.includes(difficulty)) throw new Error("Geçersiz zorluk derecesi.");

  // Boş bırakılırsa teslim günü (0) kullanılır. Böylece şablondan açılan ekip
  // görevleri de zorunlu teslim tarihi kuralını ihlal etmez.
  const rawOffset = String(formData.get("dueOffsetDays") ?? "").trim();
  let dueOffsetDays = 0;
  if (rawOffset !== "") {
    dueOffsetDays = Number(rawOffset);
    if (!Number.isInteger(dueOffsetDays)) throw new Error("Gün kayması tam sayı olmalı.");
  }

  addTemplateItem({ templateId, title, priority, difficulty, dueOffsetDays });
  revalidatePath("/", "layout");
}

export async function deleteTemplateItemAction(id: string): Promise<void> {
  await requireManager();
  deleteTemplateItem(id);
  revalidatePath("/", "layout");
}

// İçeriğe şablon uygular — hem içerik oluşturulurken (NewContentForm) hem de
// sonradan içerik sayfasından çağrılır.
export async function applyTemplateAction(
  templateId: string,
  contentItemId: string,
  assigneeId: string | null,
): Promise<number> {
  await requireSession();
  const template = getTemplate(templateId);
  if (!template) throw new Error("Şablon bulunamadı.");
  const content = getContentItem(contentItemId);
  if (!content) throw new Error("İçerik bulunamadı.");
  if (template.content_type && template.content_type !== content.type) {
    throw new Error("Bu şablon içerik türüyle uyumlu değil.");
  }

  const count = applyTemplateToContent({
    templateId,
    contentItemId,
    defaultAssigneeId: activeAssigneeId(assigneeId),
  });

  await recordActivity({
    action: "template.apply",
    entityType: "content",
    entityId: contentItemId,
    brandId: content.brand_id,
    summary: `“${template.name}” şablonundan ${count} görev açtı`,
  });
  revalidatePath("/", "layout");
  return count;
}
