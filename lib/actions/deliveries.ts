"use server";

import { revalidatePath } from "next/cache";
import { recordActivity } from "@/lib/activity";
import {
  TASK_DELIVERY_STATUS_LABEL,
  TASK_REVISION_REASONS,
} from "@/lib/constants";
import {
  announceGuestDeliveryDecision,
  announceTeamDeliveryDecision,
  announceTeamDeliveryShared,
} from "@/lib/guestTaskCommunications";
import { requireGuestSession, requireTeamSession } from "@/lib/identity";
import { notifyTaskUpdate } from "@/lib/notifications";
import {
  createTaskDelivery,
  decideTaskDelivery,
  getTaskIdForDelivery,
} from "@/lib/repositories/deliveries";
import { getTask } from "@/lib/repositories/tasks";
import type { TaskDeliveryStatus, TaskRevisionReason } from "@/lib/types";
import {
  extractImageFiles,
  validateImageFiles,
  withSavedImageFiles,
} from "@/lib/uploads";

function optionalText(formData: FormData, key: string, max: number): string | null {
  const value = String(formData.get(key) ?? "").trim();
  if (value.length > max) throw new Error(`Metin en fazla ${max} karakter olabilir.`);
  return value || null;
}

function externalUrl(formData: FormData): string | null {
  const raw = optionalText(formData, "externalUrl", 2000);
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Teslim bağlantısı geçerli bir URL olmalı.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Teslim bağlantısı http veya https kullanmalı.");
  }
  return parsed.toString();
}

function decisionValue(formData: FormData): Exclude<TaskDeliveryStatus, "Beklemede"> {
  const value = String(formData.get("decision") ?? "");
  if (value !== "Onaylandi" && value !== "RevizeIstendi") {
    throw new Error("Geçerli bir teslim kararı seçilmeli.");
  }
  return value;
}

function revisionReason(
  formData: FormData,
  decision: Exclude<TaskDeliveryStatus, "Beklemede">,
): TaskRevisionReason | null {
  if (decision === "Onaylandi") return null;
  const value = String(formData.get("revisionReason") ?? "") as TaskRevisionReason;
  if (!TASK_REVISION_REASONS.includes(value)) throw new Error("Revize nedeni seçilmeli.");
  return value;
}

function revisionTarget(
  formData: FormData,
  decision: Exclude<TaskDeliveryStatus, "Beklemede">,
): number | null {
  if (decision === "Onaylandi") return null;
  const value = Number(formData.get("revisionTargetMinutes"));
  if (!Number.isInteger(value)) throw new Error("Revize hedef süresi seçilmeli.");
  return value;
}

export async function createTaskDeliveryAction(formData: FormData) {
  const actor = await requireTeamSession();
  const taskId = String(formData.get("taskId") ?? "").trim();
  const task = getTask(taskId);
  if (!task) throw new Error("Görev bulunamadı.");
  const note = optionalText(formData, "note", 2000);
  const url = externalUrl(formData);
  const images = extractImageFiles(formData);
  validateImageFiles(images);
  const guestVisible = formData.get("guestVisible") === "1";

  const delivery = await withSavedImageFiles(images, "deliveries", (saved) =>
    createTaskDelivery({
      taskId,
      note,
      externalUrl: url,
      guestVisible,
      submittedByAccountId: actor.account_id,
      submittedByName: actor.person.name,
      submittedByPersonId: actor.person.id,
    }, saved),
  );

  if (delivery.guest_visible === 1) {
    await announceTeamDeliveryShared({
      actor: actor.person,
      taskId,
      taskTitle: task.title,
      brandId: task.brand_id,
      versionNumber: delivery.version_number,
    });
  } else {
    await recordActivity({
      action: "task.delivery.submit",
      entityType: "task",
      entityId: taskId,
      brandId: task.brand_id,
      summary: `“${task.title}” görevinin V${delivery.version_number} teslimini incelemeye sundu`,
    });
  }
  notifyTaskUpdate({
    actor: actor.person,
    taskId,
    taskTitle: task.title,
    brandId: task.brand_id,
    assigneeId: task.assignee_id,
    message: `V${delivery.version_number} teslimi incelemeye sunuldu.`,
  });
  revalidatePath("/", "layout");
}

export async function decideTeamTaskDeliveryAction(formData: FormData) {
  const actor = await requireTeamSession();
  const deliveryId = String(formData.get("deliveryId") ?? "").trim();
  const taskId = getTaskIdForDelivery(deliveryId);
  const task = taskId ? getTask(taskId) : undefined;
  if (!task) throw new Error("Teslim bulunamadı.");
  const decision = decisionValue(formData);
  const delivery = decideTaskDelivery({
    deliveryId,
    decision,
    actorKind: "team",
    actorAccountId: actor.account_id,
    actorName: actor.person.name,
    actorPersonId: actor.person.id,
    decisionNote: optionalText(formData, "decisionNote", 2000),
    revisionReason: revisionReason(formData, decision),
    revisionTargetMinutes: revisionTarget(formData, decision),
  });
  const decisionLabel = TASK_DELIVERY_STATUS_LABEL[decision];
  if (delivery.guest_visible === 1) {
    await announceTeamDeliveryDecision({
      actor: actor.person,
      taskId: task.id,
      taskTitle: task.title,
      brandId: task.brand_id,
      versionNumber: delivery.version_number,
      decisionLabel,
    });
  } else {
    await recordActivity({
      action: "task.delivery.decision",
      entityType: "task",
      entityId: task.id,
      brandId: task.brand_id,
      summary: `“${task.title}” görevinin V${delivery.version_number} teslimi için ${decisionLabel.toLocaleLowerCase("tr-TR")} kararı verdi`,
    });
  }
  notifyTaskUpdate({
    actor: actor.person,
    taskId: task.id,
    taskTitle: task.title,
    brandId: task.brand_id,
    assigneeId: task.assignee_id,
    message: `V${delivery.version_number}: ${decisionLabel}.`,
  });
  revalidatePath("/", "layout");
}

export async function decideGuestTaskDeliveryAction(formData: FormData) {
  const actor = await requireGuestSession();
  const deliveryId = String(formData.get("deliveryId") ?? "").trim();
  const taskId = getTaskIdForDelivery(deliveryId);
  const task = taskId ? getTask(taskId) : undefined;
  if (!task || task.brand_id !== actor.brand.id || task.origin !== "guest") {
    throw new Error("Teslim bulunamadı.");
  }
  const decision = decisionValue(formData);
  const delivery = decideTaskDelivery({
    deliveryId,
    decision,
    actorKind: "guest",
    actorAccountId: actor.account_id,
    actorName: `${actor.brand.name} Guest`,
    actorPersonId: null,
    brandId: actor.brand.id,
    decisionNote: optionalText(formData, "decisionNote", 2000),
    revisionReason: revisionReason(formData, decision),
    revisionTargetMinutes: revisionTarget(formData, decision),
  });
  await announceGuestDeliveryDecision({
    guestAccountId: actor.account_id,
    guestName: `${actor.brand.name} Guest`,
    taskId: task.id,
    taskTitle: task.title,
    brandId: task.brand_id,
    assigneeId: task.assignee_id,
    versionNumber: delivery.version_number,
    decisionLabel: TASK_DELIVERY_STATUS_LABEL[decision],
  });
  revalidatePath("/guest", "layout");
}
