import { insertActivity } from "@/lib/repositories/activity";
import { isTaskShared } from "@/lib/taskSharing";
import { createNotification } from "@/lib/repositories/notifications";
import { getActiveGuestAccountForBrand } from "@/lib/repositories/accounts";
import { listActivePeople } from "@/lib/repositories/people";
import { listClientRequestNotificationRecipients } from "@/lib/repositories/people";
import type { ActivityEntityType, Person } from "@/lib/types";

interface GuestTaskBase {
  guestAccountId: string;
  guestName: string;
  taskId: string;
  taskTitle: string;
  brandId: string;
}

interface TeamTaskBase {
  actor: Person;
  taskId: string;
  taskTitle: string;
  brandId: string;
}

function shortMessage(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 160 ? `${trimmed.slice(0, 159)}…` : trimmed;
}

function recordCommunicationActivity(input: {
  actorId: string | null;
  actorName: string;
  action: string;
  entityId: string;
  brandId: string;
  summary: string;
  entityType?: ActivityEntityType;
}): void {
  try {
    insertActivity({
      actorId: input.actorId,
      actorName: input.actorName,
      action: input.action,
      entityType: input.entityType ?? "task",
      entityId: input.entityId,
      brandId: input.brandId,
      summary: input.summary,
    });
  } catch {
    // Aktivite akışı asıl görev mutasyonunu başarısız kılmamalı.
  }
}

function notifyTeam(input: GuestTaskBase & { assigneeId?: string | null; summary: string }): void {
  try {
    const recipients = listActivePeople().filter(
      (person) => person.is_manager === 1 || (input.assigneeId && person.id === input.assigneeId),
    );
    for (const person of recipients) {
      createNotification({
        recipientId: person.id,
        recipientName: person.name,
        actorId: input.guestAccountId,
        actorName: input.guestName,
        taskId: input.taskId,
        brandId: input.brandId,
        summary: input.summary,
      });
    }
  } catch {
    // Bildirim ana guest işlemini bozmayan en iyi çaba yan etkisidir.
  }
}

function notifyGuest(input: TeamTaskBase & { summary: string }): void {
  try {
    if (!isTaskShared(input.taskId,input.brandId)) return;
    const guest = getActiveGuestAccountForBrand(input.brandId);
    if (!guest) return;
    createNotification({
      recipientId: guest.id,
      recipientName: guest.brand_name,
      actorId: input.actor.id,
      actorName: input.actor.name,
      taskId: input.taskId,
      brandId: input.brandId,
      summary: input.summary,
    });
  } catch {
    // Bildirim ana ekip işlemini bozmayan en iyi çaba yan etkisidir.
  }
}

/**
 * Müşteri portalından gelen yeni istek artık üretim görevi değil TALEP açıyor;
 * bu yüzden bildirim/etkinlik de görev değil talep kaydına bağlanıyor.
 * Etkinlik kaydında `taskId` YOK: olmayan bir göreve bağlantı vermiyoruz.
 */
export async function announceGuestRequestCreated(input: {
  guestName: string;
  requestId: string;
  requestTitle: string;
  brandId: string;
}): Promise<void> {
  const summary = `${input.guestName}, “${input.requestTitle}” talebini değerlendirme kuyruğuna ekledi`;
  try {
    const recipients = listClientRequestNotificationRecipients();
    for (const person of recipients) {
      createNotification({
        recipientId: person.id,
        recipientName: person.name,
        actorId: null,
        actorName: input.guestName,
        taskId: null,
        brandId: input.brandId,
        summary,
      });
    }
  } catch {
    // Bildirim ana guest işlemini bozmayan en iyi çaba yan etkisidir.
  }
  recordCommunicationActivity({
    actorId: null,
    actorName: input.guestName,
    action: "guest.request.created",
    entityType: "request",
    entityId: input.requestId,
    brandId: input.brandId,
    summary,
  });
}

export async function announceGuestComment(input: GuestTaskBase & { assigneeId: string | null; body: string }): Promise<void> {
  const summary = `${input.guestName}, “${input.taskTitle}” talebine yorum ekledi: ${shortMessage(input.body)}`;
  notifyTeam({ ...input, summary });
  recordCommunicationActivity({
    actorId: input.guestAccountId,
    actorName: input.guestName,
    action: "guest.comment.created",
    entityId: input.taskId,
    brandId: input.brandId,
    summary,
  });
}

export async function announceTeamSharedReply(input: TeamTaskBase & { body: string }): Promise<void> {
  const summary = `${input.actor.name}, “${input.taskTitle}” talebinize yanıt verdi: ${shortMessage(input.body)}`;
  notifyGuest({ ...input, summary });
  recordCommunicationActivity({
    actorId: input.actor.id,
    actorName: input.actor.name,
    action: "team.shared_reply",
    entityId: input.taskId,
    brandId: input.brandId,
    summary: `${input.actor.name}, “${input.taskTitle}” talebine guest ile paylaşılan yanıt ekledi`,
  });
}

export async function announceGuestTaskPlanned(input: TeamTaskBase): Promise<void> {
  const summary = `${input.actor.name}, “${input.taskTitle}” talebinizi planladı`;
  notifyGuest({ ...input, summary });
  recordCommunicationActivity({
    actorId: input.actor.id,
    actorName: input.actor.name,
    action: "guest.task.planned",
    entityId: input.taskId,
    brandId: input.brandId,
    summary,
  });
}

export async function announceGuestTaskStatus(input: TeamTaskBase & { statusLabel: string }): Promise<void> {
  const summary = `${input.actor.name}, “${input.taskTitle}” talebinizi ${input.statusLabel} durumuna aldı`;
  notifyGuest({ ...input, summary });
  recordCommunicationActivity({
    actorId: input.actor.id,
    actorName: input.actor.name,
    action: "guest.task.status",
    entityId: input.taskId,
    brandId: input.brandId,
    summary,
  });
}

export async function announceTeamDeliveryShared(
  input: TeamTaskBase & { versionNumber: number },
): Promise<void> {
  const summary = `${input.actor.name}, “${input.taskTitle}” görevinin V${input.versionNumber} teslimini onayınıza sundu`;
  notifyGuest({ ...input, summary });
  recordCommunicationActivity({
    actorId: input.actor.id,
    actorName: input.actor.name,
    action: "task.delivery.shared",
    entityId: input.taskId,
    brandId: input.brandId,
    summary,
  });
}

export async function announceGuestDeliveryDecision(
  input: GuestTaskBase & {
    assigneeId: string | null;
    versionNumber: number;
    decisionLabel: string;
  },
): Promise<void> {
  const summary = `${input.guestName}, “${input.taskTitle}” görevinin V${input.versionNumber} teslimi için ${input.decisionLabel.toLocaleLowerCase("tr-TR")} kararı verdi`;
  notifyTeam({ ...input, summary });
  recordCommunicationActivity({
    actorId: input.guestAccountId,
    actorName: input.guestName,
    action: "guest.delivery.decision",
    entityId: input.taskId,
    brandId: input.brandId,
    summary,
  });
}

export async function announceTeamDeliveryDecision(
  input: TeamTaskBase & { versionNumber: number; decisionLabel: string },
): Promise<void> {
  const summary = `${input.actor.name}, “${input.taskTitle}” görevinin V${input.versionNumber} teslimini ${input.decisionLabel.toLocaleLowerCase("tr-TR")} olarak işaretledi`;
  notifyGuest({ ...input, summary });
  recordCommunicationActivity({
    actorId: input.actor.id,
    actorName: input.actor.name,
    action: "team.delivery.decision",
    entityId: input.taskId,
    brandId: input.brandId,
    summary,
  });
}
