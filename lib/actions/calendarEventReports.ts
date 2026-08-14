"use server";

import { revalidatePath } from "next/cache";
import { recordActivity } from "@/lib/activity";
import { requireTeamSession } from "@/lib/identity";
import {
  getReportableCalendarEvent,
  saveCalendarEventReport,
} from "@/lib/repositories/calendarEventReports";

function optionalText(formData: FormData, key: string, label: string, max: number): string | null {
  const value = String(formData.get(key) ?? "").trim();
  if (value.length > max) throw new Error(`${label} en fazla ${max} karakter olabilir.`);
  return value || null;
}

export async function saveCalendarEventReportAction(formData: FormData): Promise<void> {
  const actor = await requireTeamSession();
  const eventId = String(formData.get("eventId") ?? "").trim();
  if (!eventId || eventId.length > 80) throw new Error("Etkinlik seçimi geçersiz.");
  const event = getReportableCalendarEvent(eventId);
  if (!event) throw new Error("Raporlanabilir toplantı veya çekim bulunamadı.");

  const result = saveCalendarEventReport({
    eventId,
    participants: optionalText(formData, "participants", "Katılımcılar", 1200),
    summary: optionalText(formData, "summary", "Rapor özeti", 8000),
    decisions: optionalText(formData, "decisions", "Kararlar ve çıktılar", 6000),
    nextSteps: optionalText(formData, "nextSteps", "Sonraki adımlar", 6000),
    updatedById: actor.person.id,
  });

  await recordActivity({
    action: result === "cleared" ? "calendar.report.clear" : "calendar.report.update",
    entityType: "calendar_event",
    entityId: event.id,
    brandId: event.brand_id,
    summary: result === "cleared"
      ? `“${event.title}” ${event.type === "Toplanti" ? "toplantı" : "çekim"} raporunu temizledi`
      : `“${event.title}” ${event.type === "Toplanti" ? "toplantı" : "çekim"} raporunu güncelledi`,
  });

  revalidatePath(`/brands/${event.brand_id}`);
  revalidatePath(`/brands/${event.brand_id}/reports`);
}
