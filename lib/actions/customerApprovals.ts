"use server";

import { revalidatePath } from "next/cache";
import { recordActivity } from "@/lib/activity";
import { ExpectedActionError, runAction, runAfterCommit, type ActionResult } from "@/lib/actionResult";
import { requireTeamSession } from "@/lib/identity";
import { canReviewClientRequests } from "@/lib/requestAccess";
import { recordCustomerApproval } from "@/lib/repositories/customerApprovals";
import { getTask, setTaskCustomerApprovalRequirement } from "@/lib/repositories/tasks";
import { changeTaskStatuses, TaskTransitionError } from "@/lib/taskLifecycle";
import {
  CUSTOMER_APPROVAL_CHANNEL_LABEL,
  isCustomerApprovalChannel,
} from "@/lib/taskApproval";
import { safeHttpUrl } from "@/lib/urlSafety";

function cleanText(value: FormDataEntryValue | null, max: number, label: string): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.length > max) throw new ExpectedActionError(`${label} en fazla ${max} karakter olabilir.`);
  return text;
}

/**
 * Müşteri onayını KAYDEDER ve görevi "Onaylandı (Müşteri)" aşamasına taşır.
 * Onayı müşterinin kendisi değil, yetkili ekip üyesi dışarıdan gelen bilgiye
 * dayanarak giriyor — bu yüzden onayı veren müşteri adı ile kaydeden ekip
 * üyesi ayrı alanlarda tutuluyor.
 */
export async function recordCustomerApprovalAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireTeamSession();
  return runAction("task.recordCustomerApproval", async () => {
    const person = actor.person;
    // Yetki: yönetici veya ayrıca yetkilendirilmiş değerlendirici.
    if (person.is_manager !== 1 && !canReviewClientRequests(person)) {
      throw new ExpectedActionError(
        "Müşteri onayını yalnızca yöneticiler veya yetkilendirilmiş değerlendiriciler kaydedebilir.",
        "forbidden",
      );
    }
    const taskId = String(formData.get("taskId") ?? "").trim();
    if (!taskId) throw new ExpectedActionError("Görev bulunamadı.", "notFound");
    const task = getTask(taskId);
    if (!task) throw new ExpectedActionError("Görev bulunamadı.", "notFound");

    const customerName = cleanText(formData.get("customerName"), 120, "Onayı veren kişi");
    if (!customerName) throw new ExpectedActionError("Onayı veren müşteri adı zorunlu.");
    const channel = String(formData.get("channel") ?? "");
    if (!isCustomerApprovalChannel(channel)) throw new ExpectedActionError("Onay kanalı seçilmeli.");
    // Bağlantı İSTEĞE BAĞLI; verilirse şema doğrulamasından geçer.
    const rawUrl = cleanText(formData.get("referenceUrl"), 500, "Bağlantı");
    const referenceUrl = rawUrl ? safeHttpUrl(rawUrl) : null;
    if (rawUrl && !referenceUrl) throw new ExpectedActionError("Bağlantı yalnızca http veya https olabilir.");
    const note = cleanText(formData.get("note"), 1000, "Not");

    try {
      recordCustomerApproval({
        taskId,
        customerName,
        channel,
        referenceUrl,
        note,
        approvedAt: null,
        recordedById: person.id,
        recordedByName: person.name,
      });
      // Kayıt ile durum geçişi AYNI isteğin parçası; durum geçişi kendi
      // transaction'ında onayın varlığını yeniden doğruluyor.
      changeTaskStatuses([taskId], "MusteriOnayladi", person.id);
    } catch (error) {
      if (error instanceof TaskTransitionError) throw new ExpectedActionError(error.message);
      throw error;
    }

    await runAfterCommit("task.recordCustomerApproval", () =>
      recordActivity({
        action: "task.customerApproval",
        entityType: "task",
        entityId: taskId,
        brandId: task.brand_id,
        summary: `“${task.title}” için müşteri onayını kaydetti (${customerName} · ${CUSTOMER_APPROVAL_CHANNEL_LABEL[channel]})`,
      }),
    );

    revalidatePath("/", "layout");
    return { ok: true as const, message: "Müşteri onayı kaydedildi." };
  });
}

/**
 * Görev özelinde müşteri onayı gerekliliğine gerekçeli istisna. Marka
 * varsayılanını DEĞİŞTİRMEZ; yalnız bu görevi etkiler.
 */
export async function setTaskCustomerApprovalAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireTeamSession();
  return runAction("task.setCustomerApproval", async () => {
    const person = actor.person;
    if (person.is_manager !== 1 && !canReviewClientRequests(person)) {
      throw new ExpectedActionError(
        "Müşteri onayı istisnasını yalnızca yöneticiler veya yetkilendirilmiş değerlendiriciler verebilir.",
        "forbidden",
      );
    }
    const taskId = String(formData.get("taskId") ?? "").trim();
    const required = String(formData.get("required") ?? "") === "1";
    const reason = cleanText(formData.get("reason"), 500, "Gerekçe");
    if (!reason) throw new ExpectedActionError("İstisna için gerekçe zorunlu.");
    const task = getTask(taskId);
    if (!task) throw new ExpectedActionError("Görev bulunamadı.", "notFound");
    if (task.status === "Yayinlandi" || task.archived_at !== null) {
      throw new ExpectedActionError("Yayınlanmış veya arşivlenmiş görevin onay kuralı değiştirilemez.");
    }
    if (!setTaskCustomerApprovalRequirement(taskId, required, reason, person.id)) {
      throw new ExpectedActionError("Bu görev zaten istenen ayarda.");
    }

    await runAfterCommit("task.setCustomerApproval", () =>
      recordActivity({
        action: "task.customerApprovalRule",
        entityType: "task",
        entityId: taskId,
        brandId: task.brand_id,
        summary: required
          ? `“${task.title}” için müşteri onayını zorunlu yaptı`
          : `“${task.title}” için müşteri onayı zorunluluğunu kaldırdı`,
      }),
    );

    revalidatePath("/", "layout");
    return { ok: true as const, message: "Onay kuralı güncellendi." };
  });
}
