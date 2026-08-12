import { extractMentionedPeople } from "@/lib/mentions";
import { createNotification } from "@/lib/repositories/notifications";
import { notificationExistsForCalendarEvent } from "@/lib/repositories/notifications";
import { getActiveGuestAccountForBrand } from "@/lib/repositories/accounts";
import { getPerson, listActivePeople } from "@/lib/repositories/people";
import type { Person } from "@/lib/types";

const NOTIFY_MESSAGE_MAX = 160;

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

// Bir yorum gövdesindeki @mention'lardan bildirim üretir. `recordActivity()`
// (lib/activity.ts) ile aynı felsefe: bildirim üretimi asıl yorum gönderimini
// ASLA bozmamalı — bu yüzden tüm gövde try/catch içinde, hata sessizce yutulur.
// Dönüş değeri (bildirim giden kişi id'leri) `notifyTaskUpdate`'in aynı olayı
// ikinci kez bildirmemesi için kullanılır (bkz. lib/actions/comments.ts).
export function notifyMentions(input: {
  body: string;
  actor: Person;
  taskId: string;
  taskTitle: string;
  brandId: string | null;
}): string[] {
  try {
    const people = listActivePeople();
    const mentioned = extractMentionedPeople(input.body, people).filter(
      // Kendine mention atan kişiye bildirim gitmez.
      (p) => p.id !== input.actor.id,
    );
    if (mentioned.length === 0) return [];

    const summary = `${input.actor.name} seni “${input.taskTitle}” görevindeki bir yorumda etiketledi`;
    for (const person of mentioned) {
      createNotification({
        recipientId: person.id,
        recipientName: person.name,
        actorId: input.actor.id,
        actorName: input.actor.name,
        taskId: input.taskId,
        brandId: input.brandId,
        summary,
      });
    }
    return mentioned.map((p) => p.id);
  } catch {
    // yut — bildirim en iyi çabadır, asıl yorum kaydını asla düşürmez.
    return [];
  }
}

// Bir görev güncellendiğinde (detay/not düzenleme, yorum eklenmesi) hem
// görevin sahibine hem de sahibin departmanındaki diğer kişilere ("ilgili
// ekip") bildirim üretir. Güncellemeyi yapan kişiye bildirim gitmez.
// `message` verilmezse jenerik bir özet kullanılır; verilirse güncelleyenin
// kendi yazdığı kişiselleştirilmiş not bildirimin gövdesi olur.
// notifyMentions ile aynı gerekçeyle tüm gövde best-effort try/catch içinde.
export function notifyTaskUpdate(input: {
  actor: Person;
  taskId: string;
  taskTitle: string;
  brandId: string | null;
  assigneeId: string | null;
  message?: string | null;
  // Aynı olay için zaten başka bir kanaldan (ör. @mention) bildirim almış
  // kişiler — burada tekrar bildirilmesinler diye.
  excludeIds?: string[];
}): void {
  try {
    // Sahipsiz görevde ne "görev sahibi" ne de bir "ekip" vardır.
    if (!input.assigneeId) return;
    const assignee = getPerson(input.assigneeId);
    if (!assignee || assignee.active !== 1) return;

    const exclude = new Set(input.excludeIds ?? []);
    exclude.add(input.actor.id);

    const detail = input.message ? truncate(input.message, NOTIFY_MESSAGE_MAX) : null;

    if (!exclude.has(assignee.id)) {
      createNotification({
        recipientId: assignee.id,
        recipientName: assignee.name,
        actorId: input.actor.id,
        actorName: input.actor.name,
        taskId: input.taskId,
        brandId: input.brandId,
        summary: detail
          ? `${input.actor.name} “${input.taskTitle}” görevini güncelledi: ${detail}`
          : `${input.actor.name} “${input.taskTitle}” görevini güncelledi`,
      });
    }

    // İlgili ekip = görev sahibiyle aynı departmandaki diğer aktif kişiler.
    // Departmanı yoksa ("Diğer" kovası) e-posta listesi gibi geniş bir kitleye
    // gitmesin diye ekip bildirimi hiç üretilmez — yalnızca görev sahibi bilgilenir.
    if (!assignee.department) return;
    const teamPeers = listActivePeople().filter(
      (p) => p.department === assignee.department && p.id !== assignee.id && !exclude.has(p.id),
    );
    if (teamPeers.length === 0) return;

    // Görev sahibi kendi görevini güncellerse "Ekin, Ekin kişisinin..." gibi
    // kendini tekrar eden bir cümle kurulmasın diye actor === assignee ayrı ele alınır.
    const teamSummary = detail
      ? `${assignee.name} — “${input.taskTitle}” görevine güncelleme: ${detail}`
      : input.actor.id === assignee.id
        ? `${assignee.name} “${input.taskTitle}” görevini güncelledi`
        : `${input.actor.name}, ${assignee.name} adına atanan “${input.taskTitle}” görevini güncelledi`;
    for (const person of teamPeers) {
      createNotification({
        recipientId: person.id,
        recipientName: person.name,
        actorId: input.actor.id,
        actorName: input.actor.name,
        taskId: input.taskId,
        brandId: input.brandId,
        summary: teamSummary,
      });
    }
  } catch {
    // yut — bildirim en iyi çabadır, asıl güncellemeyi asla düşürmez.
  }
}

export function notifyGuestCalendarEvent(input: {
  actor: Person;
  calendarEventId: string;
  brandId: string;
  title: string;
  typeLabel: string;
}): void {
  try {
    const guest = getActiveGuestAccountForBrand(input.brandId);
    if (!guest || notificationExistsForCalendarEvent(guest.id, input.calendarEventId)) return;
    createNotification({
      recipientId: guest.id,
      recipientName: guest.brand_name,
      actorId: input.actor.id,
      actorName: input.actor.name,
      taskId: null,
      calendarEventId: input.calendarEventId,
      brandId: input.brandId,
      summary: `${input.actor.name}, “${input.title}” ${input.typeLabel.toLocaleLowerCase("tr-TR")} etkinliğini sizinle paylaştı`,
    });
  } catch {
    // Bildirim en iyi çabadır; takvim kaydının oluşmasını engellemez.
  }
}
