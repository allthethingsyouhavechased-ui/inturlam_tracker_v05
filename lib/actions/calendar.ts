"use server";

import { revalidatePath } from "next/cache";
import { requireTeamSession } from "@/lib/identity";
import { syncCalendarEventNow } from "@/lib/calendar/google";
import { notifyGuestCalendarEvent } from "@/lib/notifications";
import { cancelCalendarEvent, getCalendarEvent, saveCalendarEvent } from "@/lib/repositories/calendarEvents";
import type { CalendarEventType } from "@/lib/types";

const TYPES: CalendarEventType[] = ["Toplanti", "Cekim", "Diger"];

function optional(formData: FormData, key: string, max: number): string | null {
  const value = String(formData.get(key) ?? "").trim();
  if (value.length > max) throw new Error(`${key} en fazla ${max} karakter olabilir.`);
  return value || null;
}

function normalizeDateTime(value: FormDataEntryValue | null, allDay: boolean): string {
  const text = String(value ?? "").trim();
  if (allDay) {
    if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/.test(text)) throw new Error("Etkinlik tarihi geçersiz.");
    return text.slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date(`${text}T00:00:00+03:00`).toISOString();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) throw new Error("Etkinlik tarih/saat bilgisi geçersiz.");
  const parsed = new Date(`${text}:00+03:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Etkinlik tarih/saat bilgisi geçersiz.");
  return parsed.toISOString();
}

function nextDay(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export async function saveCalendarEventAction(formData: FormData) {
  const actor = await requireTeamSession();
  const id = optional(formData, "eventId", 80) ?? undefined;
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "Toplanti") as CalendarEventType;
  const allDay = formData.get("allDay") === "1";
  if (!title || title.length > 200) throw new Error("Etkinlik başlığı 1-200 karakter olmalı.");
  if (!TYPES.includes(type)) throw new Error("Etkinlik türü geçersiz.");
  const startAt = normalizeDateTime(formData.get("startAt"), allDay);
  let endAt = normalizeDateTime(formData.get("endAt"), allDay);
  if (allDay && endAt <= startAt) endAt = nextDay(startAt);
  if (!allDay && Date.parse(endAt) <= Date.parse(startAt)) throw new Error("Bitiş başlangıçtan sonra olmalı.");
  const brandId = optional(formData, "brandId", 80);
  const guestVisible = formData.get("guestVisible") === "1";
  const existing = id ? getCalendarEvent(id) : undefined;
  const eventId = saveCalendarEvent({
    id,
    brandId,
    type,
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
