import type { BadgeTone } from "@/components/ui/Badge";
import type { ClientRequestStatus } from "@/lib/types";

// Akış: Yeni → İncelemede → Bilgi/Revize Bekleniyor → Onaylandı | Reddedildi.
// 'Beklemede' teknik değeri korunuyor, arayüzde "Yeni" yazıyor.
export const CLIENT_REQUEST_STATUSES: ClientRequestStatus[] = [
  "Beklemede",
  "Incelemede",
  "BilgiBekleniyor",
  "Onaylandi",
  "Reddedildi",
];

export const CLIENT_REQUEST_STATUS_LABEL: Record<ClientRequestStatus, string> = {
  Beklemede: "Yeni",
  Incelemede: "İncelemede",
  BilgiBekleniyor: "Bilgi/Revize bekleniyor",
  Onaylandi: "Onaylandı",
  Reddedildi: "Reddedildi",
};

export const CLIENT_REQUEST_STATUS_TONE: Record<ClientRequestStatus, BadgeTone> = {
  Beklemede: "warning",
  Incelemede: "violet",
  BilgiBekleniyor: "brand",
  Onaylandi: "success",
  Reddedildi: "danger",
};

export const CLIENT_REQUEST_STATUS_DOT: Record<ClientRequestStatus, string> = {
  Beklemede: "bg-amber-500",
  Incelemede: "bg-violet-500",
  BilgiBekleniyor: "bg-cyan-500",
  Onaylandi: "bg-emerald-500",
  Reddedildi: "bg-rose-500",
};

// Müşteri portalından gelen talepte hedef departman MÜŞTERİ tarafından
// seçilmiyor; değerlendirmede belirleniyor. Kayıt açılırken bir değer
// gerektiği için nötr bir başlangıç kullanılıyor.
export const DEFAULT_GUEST_REQUEST_DEPARTMENT = "social";
