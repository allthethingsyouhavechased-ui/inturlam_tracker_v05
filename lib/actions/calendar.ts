"use server";

import { revalidatePath } from "next/cache";
import { requireManager, requireTeamSession } from "@/lib/identity";
import { runCalendarSync, syncCalendarEventNow } from "@/lib/calendar/google";
import { notifyGuestCalendarEvent } from "@/lib/notifications";
import { cancelCalendarEvent, getCalendarEvent, saveCalendarEvent } from "@/lib/repositories/calendarEvents";
import { isCalendarEventColor } from "@/lib/calendar/colors";
import { normalizeCalendarFormRange } from "@/lib/calendar/time";
import type { CalendarEventColor, CalendarEventType } from "@/lib/types";

const TYPES: CalendarEventType[] = ["Toplanti", "Cekim", "Diger"];

function optional(formData: FormData, key: string, max: number): string | null {
  const value = String(formData.get(key) ?? "").trim();
  if (value.length > max) throw new Error(`${key} en fazla ${max} karakter olabilir.`);
  return value || null;
}

export async function saveCalendarEventAction(formData: FormData) {
  const actor = await requireTeamSession();
  const id = optional(formData, "eventId", 80) ?? undefined;
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "Toplanti") as CalendarEventType;
  const requestedColor = String(formData.get("colorKey") ?? "auto");
  if (!isCalendarEventColor(requestedColor)) throw new Error("Etkinlik rengi geçersiz.");
  const colorKey: CalendarEventColor = requestedColor;
  const allDay = formData.get("allDay") === "1";
  if (!title || title.length > 200) throw new Error("Etkinlik başlığı 1-200 karakter olmalı.");
  if (!TYPES.includes(type)) throw new Error("Etkinlik türü geçersiz.");
  const { startAt, endAt } = normalizeCalendarFormRange(formData.get("startAt"), formData.get("endAt"), allDay);
  const brandId = optional(formData, "brandId", 80);
  const guestVisible = formData.get("guestVisible") === "1";
  const existing = id ? getCalendarEvent(id) : undefined;
  const eventId = saveCalendarEvent({
    id,
    brandId,
    type,
    colorKey,
    title,
    description: optional(formData, "description", 5000),
    startAt,
    endAt,
    allDay,
    location: optional(formData, "location", 300),
    guestVisible,
    accountId: actor.account_id,
  });
  if (
    brandId && guestVisible
    && (!existing || existing.guest_visible !== 1 || existing.brand_id !== brandId)
  ) {
    const typeLabel = type === "Toplanti" ? "Toplantı" : type === "Cekim" ? "Çekim" : "Diğer";
    notifyGuestCalendarEvent({
      actor: actor.person,
      calendarEventId: eventId,
      brandId,
      title,
      typeLabel,
    });
  }
  await syncCalendarEventNow(eventId);
  revalidatePath("/calendar", "layout");
  revalidatePath("/guest/calendar");
}

export async function cancelCalendarEventAction(id: string) {
  await requireTeamSession();
  if (!getCalendarEvent(id)) throw new Error("Etkinlik bulunamadı.");
  cancelCalendarEvent(id);
  await syncCalendarEventNow(id);
  revalidatePath("/calendar", "layout");
  revalidatePath("/guest/calendar");
}

export async function runCalendarSyncAction(): Promise<void> {
  await requireManager();
  await runCalendarSync("manual");
  revalidatePath("/calendar");
}
