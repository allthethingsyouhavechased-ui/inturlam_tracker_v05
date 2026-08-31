import { createSign } from "node:crypto";
import type { CalendarEvent, CalendarEventType } from "@/lib/types";
import { colorFromGoogle, googleColorId, isCalendarEventColor } from "@/lib/calendar/colors";
import {
  applyInboundGoogleEvent,
  getCalendarEvent,
  getCalendarSyncState,
  listPendingCalendarEvents,
  markCalendarEventSynced,
  markCalendarEventSyncError,
  setCalendarSyncState,
  type GoogleCalendarEventRecord,
} from "@/lib/repositories/calendarEvents";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/calendar";
let cachedToken: { value: string; expiresAt: number } | null = null;

function env() {
  return {
    calendarId: process.env.GOOGLE_CALENDAR_ID?.trim() ?? "",
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ?? "",
    privateKey: (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  };
}

export function isGoogleCalendarConfigured(): boolean {
  const config = env();
  return Boolean(config.calendarId && config.email && config.privateKey);
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const config = env();
  if (!isGoogleCalendarConfigured()) throw new Error("Google Calendar yapılandırması eksik.");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(JSON.stringify({ iss: config.email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(config.privateKey);
  const assertion = `${unsigned}.${signature.toString("base64url")}`;
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!response.ok) throw new Error(`Google OAuth başarısız (${response.status}).`);
  const data = await response.json() as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function googleFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken();
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  return response;
}

export function calendarEventToGoogleBody(event: CalendarEvent) {
  const privateProperties: Record<string, string> = {
    inturlamTrackerId: event.id,
    inturlamEventType: event.type,
    inturlamGuestVisible: event.guest_visible === 1 ? "1" : "0",
    inturlamColorKey: event.color_key,
  };
  if (event.brand_id) privateProperties.inturlamBrandId = event.brand_id;
  return {
    summary: event.title,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    colorId: googleColorId(event.color_key),
    start: event.all_day === 1 ? { date: event.start_at.slice(0, 10) } : { dateTime: event.start_at, timeZone: "Europe/Istanbul" },
    end: event.all_day === 1 ? { date: event.end_at.slice(0, 10) } : { dateTime: event.end_at, timeZone: "Europe/Istanbul" },
    extendedProperties: { private: privateProperties },
  };
}

interface GoogleEvent {
  id: string;
  etag?: string;
  status?: string;
  updated?: string;
  summary?: string;
  description?: string;
  location?: string;
  colorId?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
}

function normalizeRemote(event: GoogleEvent): GoogleCalendarEventRecord {
  const meta = event.extendedProperties?.private ?? {};
  const type = (["Toplanti", "Cekim", "Diger"] as CalendarEventType[]).includes(meta.inturlamEventType as CalendarEventType)
    ? meta.inturlamEventType as CalendarEventType : "Toplanti";
  const allDay = Boolean(event.start?.date);
  const colorKey = isCalendarEventColor(meta.inturlamColorKey)
    ? meta.inturlamColorKey
    : colorFromGoogle(event.colorId);
  return {
    googleEventId: event.id,
    trackerId: meta.inturlamTrackerId || null,
    etag: event.etag ?? null,
    updatedAt: event.updated ?? new Date().toISOString(),
    status: event.status ?? "confirmed",
    brandId: meta.inturlamBrandId || null,
    type,
    colorKey,
    title: event.summary?.trim() || "Adsız etkinlik",
    description: event.description ?? null,
    startAt: event.start?.dateTime ?? event.start?.date ?? "1970-01-01",
    endAt: event.end?.dateTime ?? event.end?.date ?? "1970-01-02",
    allDay,
    location: event.location ?? null,
    guestVisible: meta.inturlamGuestVisible === "1",
  };
}

async function readGoogleEvent(id: string): Promise<GoogleEvent | null> {
  const config = env();
  const response = await googleFetch(`/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(id)}`);
  if (response.status === 404 || response.status === 410) return null;
  if (!response.ok) throw new Error(`Google etkinliği okunamadı (${response.status}).`);
  return response.json() as Promise<GoogleEvent>;
}

export async function syncCalendarEventNow(id: string): Promise<boolean> {
  if (!isGoogleCalendarConfigured()) return false;
  const event = getCalendarEvent(id);
  if (!event) return false;
  const config = env();
  try {
    if (event.deleted_at) {
      if (event.google_event_id) {
        const response = await googleFetch(`/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(event.google_event_id)}`, { method: "DELETE" });
        if (!response.ok && response.status !== 404 && response.status !== 410) throw new Error(`Google iptali başarısız (${response.status}).`);
      }
      markCalendarEventSynced({ id, googleEventId: event.google_event_id, etag: event.google_etag, googleUpdatedAt: new Date().toISOString() });
      return true;
    }

    const path = `/calendars/${encodeURIComponent(config.calendarId)}/events${event.google_event_id ? `/${encodeURIComponent(event.google_event_id)}` : ""}`;
    let response = await googleFetch(path, {
      method: event.google_event_id ? "PUT" : "POST",
      headers: event.google_event_id && event.google_etag ? { "If-Match": event.google_etag } : undefined,
      body: JSON.stringify(calendarEventToGoogleBody(event)),
    });
    if (response.status === 412 && event.google_event_id) {
      const remote = await readGoogleEvent(event.google_event_id);
      if (remote && Date.parse(remote.updated ?? "") > Date.parse(event.updated_at)) {
        applyInboundGoogleEvent(normalizeRemote(remote));
        return true;
      }
      response = await googleFetch(path, { method: "PUT", body: JSON.stringify(calendarEventToGoogleBody(event)) });
    }
    if (!response.ok) throw new Error(`Google etkinlik yazımı başarısız (${response.status}).`);
    const remote = await response.json() as GoogleEvent;
    markCalendarEventSynced({ id, googleEventId: remote.id, etag: remote.etag ?? null, googleUpdatedAt: remote.updated ?? null });
    return true;
  } catch (error) {
    markCalendarEventSyncError(id, error instanceof Error ? error.message : String(error));
    return false;
  }
}

export async function pullGoogleCalendarChanges(): Promise<{ inserted: number; updated: number; ignored: number }> {
  if (!isGoogleCalendarConfigured()) throw new Error("Google Calendar yapılandırması eksik.");
  const config = env();
  const startedAt = new Date().toISOString();
  const lastSync = getCalendarSyncState("google_updated_min") ?? new Date(Date.now() - 30 * 86_400_000).toISOString();
  let pageToken: string | null = null;
  let inserted = 0; let updated = 0; let ignored = 0;
  let newest = lastSync;
  // `updatedMin` ile artımlı okuma yalnızca Google'ın silinen etkinlik kayıtlarını
  // sakladığı pencere içinde geçerli; daha eskisini istemek 410 döndürür. Pencere
  // ~26-28 gün ölçüldü, yani yukarıdaki 30 günlük ilk-çalıştırma varsayılanı HER
  // ZAMAN 410 veriyordu ve takvim hiç bağlanamıyordu. Google'ın önerdiği davranış:
  // 410 gelince artımlı okumadan vazgeçip tam listeyi çekmek.
  let fullSync = false;
  do {
    const query = new URLSearchParams({ showDeleted: "true", singleEvents: "true", maxResults: "2500" });
    if (!fullSync) query.set("updatedMin", lastSync);
    if (pageToken) query.set("pageToken", pageToken);
    let response = await googleFetch(`/calendars/${encodeURIComponent(config.calendarId)}/events?${query}`);
    if (response.status === 410 && !fullSync) {
      fullSync = true;
      pageToken = null;
      inserted = 0; updated = 0; ignored = 0;
      const retry = new URLSearchParams({ showDeleted: "true", singleEvents: "true", maxResults: "2500" });
      response = await googleFetch(`/calendars/${encodeURIComponent(config.calendarId)}/events?${retry}`);
    }
    if (!response.ok) throw new Error(`Google takvim okuması başarısız (${response.status}).`);
    const data = await response.json() as { items?: GoogleEvent[]; nextPageToken?: string };
    for (const item of data.items ?? []) {
      const remote = normalizeRemote(item);
      const result = applyInboundGoogleEvent(remote);
      if (result === "inserted") inserted += 1; else if (result === "updated") updated += 1; else ignored += 1;
      if (remote.updatedAt > newest) newest = remote.updatedAt;
    }
    pageToken = data.nextPageToken ?? null;
  } while (pageToken);
  // Tam senkron yapıldıysa ve hiçbir etkinlik `lastSync`ten yeni değilse, damgayı
  // olduğu gibi bırakmak sonraki her çalıştırmayı yine 410'a sokar (aynı bayat
  // tarih tekrar sorulur). Bu durumda isteğin BAŞLADIĞI an yazılır — "şimdi"
  // değil, çünkü okuma sürerken güncellenen bir etkinlik atlanmamalı.
  setCalendarSyncState("google_updated_min", newest > lastSync ? newest : fullSync ? startedAt : lastSync);
  return { inserted, updated, ignored };
}

export async function runCalendarSync(source: "manual" | "scheduled" = "manual"): Promise<{ pushed: number; failed: number; inserted: number; updated: number; ignored: number }> {
  const attemptedAt = new Date().toISOString();
  setCalendarSyncState("calendar_last_attempt_at", attemptedAt);
  if (source === "scheduled") {
    setCalendarSyncState("calendar_scheduler_last_seen_at", attemptedAt);
  }
  try {
    const pulled = await pullGoogleCalendarChanges();
    let pushed = 0; let failed = 0;
    for (const event of listPendingCalendarEvents()) {
      if (await syncCalendarEventNow(event.id)) pushed += 1; else failed += 1;
    }
    const result = { pushed, failed, ...pulled };
    if (failed > 0) throw new Error(`${failed} etkinlik Google Calendar'a gönderilemedi.`);
    setCalendarSyncState("calendar_last_success_at", new Date().toISOString());
    setCalendarSyncState("calendar_last_error", "");
    setCalendarSyncState("calendar_last_result", JSON.stringify(result));
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setCalendarSyncState("calendar_last_failure_at", new Date().toISOString());
    setCalendarSyncState("calendar_last_error", message.slice(0, 1000));
    throw error;
  }
}
