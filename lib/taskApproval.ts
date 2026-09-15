// Onay akışının SAF kuralları. Hem sunucu guard'ı (lib/taskLifecycle.ts) hem
// arayüz aynı yerden okuyor; iki tarafın ayrı yorumlaması "panoda sürükleyince
// oluyor ama düğmeyle olmuyor" gibi çelişkiler üretiyordu.
import type { CustomerApprovalChannel, TaskStatus } from "@/lib/types";

/** Ekip onayından SONRAKİ müşteri aşamaları. */
export const CUSTOMER_STAGES: readonly TaskStatus[] = ["MusteriIncelemede", "MusteriOnayladi"];

export const CUSTOMER_APPROVAL_CHANNELS: CustomerApprovalChannel[] = [
  "Toplanti",
  "Telefon",
  "WhatsApp",
  "Eposta",
  "Portal",
  "Diger",
];

export const CUSTOMER_APPROVAL_CHANNEL_LABEL: Record<CustomerApprovalChannel, string> = {
  Toplanti: "Toplantı",
  Telefon: "Telefon",
  WhatsApp: "WhatsApp",
  Eposta: "E-posta",
  Portal: "Müşteri portalı",
  Diger: "Diğer",
};

export function isCustomerApprovalChannel(value: unknown): value is CustomerApprovalChannel {
  return typeof value === "string" && (CUSTOMER_APPROVAL_CHANNELS as string[]).includes(value);
}

/**
 * Bir durumun "ekip onayı verilmiş" sayılıp sayılmadığı. Müşteri aşamaları ve
 * yayın, ekip onayının ÜSTÜNE gelir — geri düşen bir iş (Revizede) buraya girmez.
 */
export function isTeamApproved(status: TaskStatus): boolean {
  return status === "Onaylandi" || status === "MusteriIncelemede"
    || status === "MusteriOnayladi" || status === "Yayinlandi";
}

/**
 * Müşteri onayı gerekiyorsa ekip onayından sonra yayın için müşteri aşaması
 * şart; gerekmiyorsa ekip onayından doğrudan yayına gidilebilir.
 */
export function requiresCustomerApproval(task: { customer_approval_required: number }): boolean {
  return task.customer_approval_required === 1;
}

/** Bir sonraki mantıklı durum — arayüzdeki "ilerlet" düğmesi bunu kullanıyor. */
export function nextTaskStatus(
  status: TaskStatus,
  customerRequired: boolean,
): TaskStatus | null {
  switch (status) {
    case "Beklemede": return "DevamEdiyor";
    case "DevamEdiyor": return "Incelemede";
    case "Revizede": return "Incelemede";
    case "Incelemede": return "Onaylandi";
    case "Onaylandi": return customerRequired ? "MusteriIncelemede" : "Yayinlandi";
    case "MusteriIncelemede": return "MusteriOnayladi";
    case "MusteriOnayladi": return "Yayinlandi";
    default: return null;
  }
}
