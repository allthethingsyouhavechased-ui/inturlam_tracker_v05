// Sosyal medya üretim planının (hedef/varlık/paylaşım takvimi) saf kuralları
// ve sabitleri. `"use client"` DEĞİL — hem Server Action'lar hem Client
// Component'ler okuyor; bir "use client" dosyasından sunucuya import edilen
// sabit gerçek değer değil bir istemci-referansı proxy'si olur.
import type { ContentKind, ContentType } from "@/lib/types";

export const CONTENT_KINDS: ContentKind[] = ["Post", "Story", "Reels"];

// Görev türü (ContentType, teknik değeri "Reel") ile stok kategorisi
// (ContentKind, "Reels") AÇIK eşleniyor. İkisi ayrı kavram olduğu için otomatik
// bir isim eşleşmesine güvenmek yanlış: "Reel" ile "Reels" string olarak
// tutmuyor, diğer türlerin (Foto, Kampanya…) stok karşılığı ise hiç yok.
export const CONTENT_TYPE_TO_KIND: Readonly<Partial<Record<ContentType, ContentKind>>> = {
  Reel: "Reels",
  Post: "Post",
  Story: "Story",
};

export function contentKindForType(type: ContentType): ContentKind | null {
  return CONTENT_TYPE_TO_KIND[type] ?? null;
}

/** Stok kategorisinin görev türü karşılığı — yalnız üçünün karşılığı var. */
export const KIND_TO_CONTENT_TYPE: Readonly<Record<ContentKind, ContentType>> = {
  Post: "Post",
  Story: "Story",
  Reels: "Reel",
};

export const CONTENT_KIND_LABEL: Record<ContentKind, string> = {
  Post: "Post",
  Story: "Story",
  Reels: "Reels",
};

export function isContentKind(value: unknown): value is ContentKind {
  return typeof value === "string" && (CONTENT_KINDS as string[]).includes(value);
}

// Üç kategorinin hepsi sıfırla başlayan bir kayıt — hedefi/varlığı hiç
// girilmemiş marka için varsayılan (repo katmanında ve takvim özetinde
// paylaşılan tek nokta).
export function emptyKindRecord(): Record<ContentKind, number> {
  return { Post: 0, Story: 0, Reels: 0 };
}

// Paylaşım takvimi hücresindeki sabit açılır liste — mevcut Google Sheet'teki
// sırayla birebir (ekip bu sıraya alışkın). LinkedIn BİLEREK yalnızca burada
// var; hedef/varlık kategorileri (CONTENT_KINDS) yalnızca Post/Story/Reels.
export const PLAN_COMBOS = [
  "Post",
  "Reels",
  "Story",
  "Post+Reels",
  "Post+Story",
  "Reels+Story",
  "Post+Reels+Story",
  "Linkedin+Post",
  "Linkedin+Reels",
  "Linkedin",
] as const;

export type PlanCombo = (typeof PLAN_COMBOS)[number];

export function isPlanCombo(value: unknown): value is PlanCombo {
  return typeof value === "string" && (PLAN_COMBOS as readonly string[]).includes(value);
}

// Her kombinasyonun hangi CONTENT_KINDS'e katkısı olduğu — "Linkedin+Reels"
// yalnızca Reels'e sayılır, "Linkedin" tek başına hiçbir türe sayılmaz.
export const COMBO_KINDS: Record<PlanCombo, ContentKind[]> = {
  Post: ["Post"],
  Reels: ["Reels"],
  Story: ["Story"],
  "Post+Reels": ["Post", "Reels"],
  "Post+Story": ["Post", "Story"],
  "Reels+Story": ["Reels", "Story"],
  "Post+Reels+Story": ["Post", "Reels", "Story"],
  "Linkedin+Post": ["Post"],
  "Linkedin+Reels": ["Reels"],
  Linkedin: [],
};

// Bir aydaki tüm plan kombinasyonlarını (birden çok gün) tür bazında toplar —
// takvim sayfasının "12/15 post · 15/15 story · 3/4 reels" özetini üretir.
// Tanınmayan bir combo string'i (ör. eski/bozuk veri) sessizce atlanır.
export function countKindsInCombos(combos: string[]): Record<ContentKind, number> {
  const totals: Record<ContentKind, number> = { Post: 0, Story: 0, Reels: 0 };
  for (const combo of combos) {
    if (!isPlanCombo(combo)) continue;
    for (const kind of COMBO_KINDS[combo]) totals[kind] += 1;
  }
  return totals;
}

// Hedef/varlık sayaçlarının üst sınırı — pratikte hiçbir marka ayda 999
// paylaşım hedeflemez, ama bir yazım hatasının (ör. yanlışlıkla 9999999
// yapıştırma) veritabanına gitmesini engeller.
export const COUNT_MAX = 999;

export function clampCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(COUNT_MAX, Math.max(0, Math.trunc(value)));
}

// Kullanıcının sayı input'una yazdığı serbest metni sayıya çevirir. Boş/NaN
// için `null` döner — çağıran taraf bunu "yok say" olarak yorumlamalı
// (TaskTargetDateEdit.tsx'teki "yarım/boş değeri yok say" dersiyle aynı
// gerekçe: input'a "15" yazarken React onChange önce "1" ile tetiklenir).
export function parseCountInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return clampCount(parsed);
}

const PLAN_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PLAN_MONTH_RE = /^\d{4}-\d{2}$/;

export function isValidPlanMonth(value: string): boolean {
  if (!PLAN_MONTH_RE.test(value)) return false;
  const parsed = new Date(`${value}-01T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 7) === value;
}

// personalTargets.ts'teki private isValidISODate ile aynı gerekçe/uygulama,
// burada export ediliyor ki hem action hem test bağımsız çağırabilsin.
export function isValidPlanDate(value: string): boolean {
  if (!PLAN_DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
