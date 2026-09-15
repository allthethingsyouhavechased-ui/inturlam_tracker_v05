import type {
  ContentStatus,
  ContentType,
  TaskPriority,
  TaskDifficulty,
  TaskDeliveryStatus,
  TaskRevisionReason,
  TaskStatus,
} from "./types";

// Kategoriler (küme) artık sabit değil — `clusters` tablosundan geliyor.
// Sunucu tarafında `listClusters()` / `clusterLabelMap()`
// (lib/repositories/clusters.ts), client component'lerde prop olarak taşınıyor.
// Tabloda karşılığı olmayan bir kategori id'si için başlık:
export const UNKNOWN_CLUSTER_LABEL = "Kategorisiz";

// Marka formlarındaki kategori select'inde "+ Yeni kategori" seçeneğinin
// value'su. Gerçek bir kategori id'siyle çakışmasın diye slug'da üretilemeyecek
// karakterler içeriyor (slugifyCluster yalnızca a-z0-9- üretir).
export const NEW_CLUSTER_VALUE = "__new__";

export const CONTENT_TYPES: ContentType[] = [
  "Reel",
  "Post",
  "Story",
  "Foto",
  "Kampanya",
  "Video",
  "Carousel",
  "KurumsalKimlik",
  "Diger",
];

// Ekip "Reels" diyor; teknik değer ("Reel") DEĞİŞMEDİ — veritabanındaki CHECK,
// eski kayıtlar ve `type_override` aynı kaldı, yalnız arayüz etiketi güncellendi.
// Sosyal plandaki ContentKind "Reels" ile eşleşmesi lib/socialPlan.ts'te açık.
export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  Reel: "Reels",
  Post: "Post",
  Story: "Story",
  Foto: "Foto",
  Kampanya: "Kampanya",
  Video: "Video",
  Carousel: "Carousel",
  KurumsalKimlik: "Kurumsal Kimlik",
  Diger: "Diğer",
};

export const CONTENT_STATUSES: ContentStatus[] = [
  "Planlandi",
  "Uretimde",
  "Tamamlandi",
  "IptalEdildi",
];

export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  Planlandi: "Planlandı",
  Uretimde: "Üretimde",
  Tamamlandi: "Tamamlandı",
  IptalEdildi: "İptal Edildi",
};

export const CONTENT_STATUS_BADGE: Record<ContentStatus, string> = {
  Planlandi: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  Uretimde: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  Tamamlandi: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  IptalEdildi: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

// Akış sırası: Beklemede → Devam Ediyor → İncelemede (Ekip) → Onaylandı (Ekip)
// → İncelemede (Müşteri) → Onaylandı (Müşteri) → Yayınlandı. "Revizede" bu
// hattın dışında, kendi sütununda duran bir bekleme durumu.
export const TASK_STATUSES: TaskStatus[] = [
  "Beklemede",
  "DevamEdiyor",
  "Incelemede",
  "Revizede",
  "Onaylandi",
  "MusteriIncelemede",
  "MusteriOnayladi",
  "Yayinlandi",
];

/** Müşteri onayı gerekmeyen işlerde ekip onayından sonra doğrudan yayına gidilir. */
export const CUSTOMER_TASK_STATUSES: TaskStatus[] = ["MusteriIncelemede", "MusteriOnayladi"];

// PANO SÜTUNLARI. Durum listesinin tamamı değil: eski beş sütuna yalnızca
// "Revizede" eklendi. Müşteri aşamaları ayrı sütun AÇMAZ — sekiz sütun panoyu
// okunmaz hâle getiriyordu ve o iki aşama ekip onayının ÜSTÜNE gelen bir alt
// durum. Kartlar "Onaylandı" sütununda, üzerlerinde müşteri rozetiyle durur
// (bkz. boardColumnFor).
export const BOARD_STATUSES: TaskStatus[] = [
  "Beklemede",
  "DevamEdiyor",
  "Incelemede",
  "Revizede",
  "Onaylandi",
  "Yayinlandi",
];

/**
 * Bir durumun hangi pano sütununda görüneceği. Müşteri aşamaları ekip
 * onayının devamı olduğu için "Onaylandı" sütununa düşer; aksi hâlde o
 * görevler panodan tamamen kaybolurdu.
 */
export function boardColumnFor(status: TaskStatus): TaskStatus | null {
  if (BOARD_STATUSES.includes(status)) return status;
  if (CUSTOMER_TASK_STATUSES.includes(status)) return "Onaylandi";
  // Eski v02 "IptalEdildi": panoda sütunu yok (patch öncesinde de yoktu).
  return null;
}

/** Kartta gösterilecek müşteri alt durumu rozeti; yoksa null. */
export const CUSTOMER_STAGE_BADGE: Partial<Record<TaskStatus, string>> = {
  MusteriIncelemede: "Müşteride",
  MusteriOnayladi: "Müşteri onayladı",
};

// ESKİ (v02) durum. Yeni bir göreve ATANAMAZ ve pano sütunu/seçim listesi
// üretmez — ama canlı veritabanında kayıtları var, bu yüzden etiket ve renk
// sözlüklerinde karşılığı bulunmalı. Sayaç/rapor gibi TÜM durumları gezen
// yerler TASK_STATUSES değil bunu kullanır.
export const LEGACY_TASK_STATUSES: TaskStatus[] = ["IptalEdildi"];
export const ALL_TASK_STATUSES: TaskStatus[] = [...TASK_STATUSES, ...LEGACY_TASK_STATUSES];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  Beklemede: "Beklemede",
  DevamEdiyor: "Devam Ediyor",
  Incelemede: "İncelemede",
  Revizede: "Revizede",
  Onaylandi: "Onaylandı",
  MusteriIncelemede: "Müşteri incelemesinde",
  MusteriOnayladi: "Müşteri onayladı",
  Yayinlandi: "Yayınlandı",
  IptalEdildi: "İptal edildi (eski)",
};

export const TASK_STATUS_BADGE: Record<TaskStatus, string> = {
  Beklemede:
    "bg-zinc-200 text-zinc-800 ring-1 ring-inset ring-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700",
  DevamEdiyor:
    "bg-sky-100 text-sky-900 ring-1 ring-inset ring-sky-300 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-800",
  Incelemede:
    "bg-violet-100 text-violet-800 ring-1 ring-inset ring-violet-300 dark:bg-violet-950 dark:text-violet-200 dark:ring-violet-800",
  Revizede:
    "bg-rose-100 text-rose-800 ring-1 ring-inset ring-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-800",
  Onaylandi:
    "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800",
  MusteriIncelemede:
    "bg-cyan-100 text-cyan-900 ring-1 ring-inset ring-cyan-300 dark:bg-cyan-950 dark:text-cyan-200 dark:ring-cyan-800",
  MusteriOnayladi:
    "bg-teal-100 text-teal-900 ring-1 ring-inset ring-teal-300 dark:bg-teal-950 dark:text-teal-200 dark:ring-teal-800",
  Yayinlandi:
    "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800",
  IptalEdildi:
    "bg-zinc-200 text-zinc-600 ring-1 ring-inset ring-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-700",
};

// Onaylandı yeşil, Yayınlandı amber (2026-08-29'da yer değiştirdiler).
// Aşağıdaki DOT / TEXT / BORDER_TOP / PROGRESS listeleri aynı eşleşmeyi
// TEKRARLIYOR — biri değişirse hepsi değişmeli, yoksa aynı durum pano
// sütununda başka, rapor çubuğunda başka renkte görünür.
export const TASK_STATUS_DOT: Record<TaskStatus, string> = {
  Beklemede: "bg-zinc-400",
  DevamEdiyor: "bg-sky-600",
  Incelemede: "bg-violet-600",
  Revizede: "bg-rose-600",
  Onaylandi: "bg-emerald-600",
  MusteriIncelemede: "bg-cyan-600",
  MusteriOnayladi: "bg-teal-600",
  Yayinlandi: "bg-amber-500",
  IptalEdildi: "bg-zinc-500",
};

// Kanban sütunlarının semantik renklerini metin üzerinde kullanan yüzeyler.
// Tonlar TASK_STATUS_DOT / TASK_STATUS_BORDER_TOP ile BİREBİR aynı ve tema
// başına ayrışmıyor: durum özetindeki "Beklemede / Devam Ediyor / …" etiketi
// panodaki sütun başlığıyla TAM aynı rengi göstermeli. Ayrı `dark:` tonu
// verilirse iki yüzey yan yana konduğunda gözle farklı renk okunuyor.
export const TASK_STATUS_TEXT: Record<TaskStatus, string> = {
  Beklemede: "text-zinc-400",
  DevamEdiyor: "text-sky-600",
  Incelemede: "text-violet-600",
  Revizede: "text-rose-600",
  Onaylandi: "text-emerald-600",
  MusteriIncelemede: "text-cyan-600",
  MusteriOnayladi: "text-teal-600",
  Yayinlandi: "text-amber-500",
  IptalEdildi: "text-zinc-500",
};

// Kanban kolon başlıklarının üst çizgisi — TASK_STATUS_DOT ile aynı renk
// paleti, ama Tailwind'in derleme-zamanı taraması runtime'da üretilen class
// string'lerini yakalayamadığı için (ör. .replace("bg-","border-t-")) ayrı
// bir sabit olarak literal yazılmalı.
export const TASK_STATUS_BORDER_TOP: Record<TaskStatus, string> = {
  Beklemede: "border-t-zinc-400",
  DevamEdiyor: "border-t-sky-600",
  Incelemede: "border-t-violet-600",
  Revizede: "border-t-rose-600",
  Onaylandi: "border-t-emerald-600",
  MusteriIncelemede: "border-t-cyan-600",
  MusteriOnayladi: "border-t-teal-600",
  Yayinlandi: "border-t-amber-500",
  IptalEdildi: "border-t-zinc-500",
};

// Rapor çubukları ve diğer dolu durum göstergeleri de yukarıdaki semantik
// paleti kullanır. Aynı durum uygulamanın hiçbir yerinde başka renge dönmez.
export const TASK_STATUS_PROGRESS: Record<TaskStatus, string> = {
  Beklemede: "bg-zinc-400 dark:bg-zinc-500",
  DevamEdiyor: "bg-sky-600",
  Incelemede: "bg-violet-600",
  Revizede: "bg-rose-600",
  Onaylandi: "bg-emerald-600",
  MusteriIncelemede: "bg-cyan-600",
  MusteriOnayladi: "bg-teal-600",
  Yayinlandi: "bg-amber-500",
  IptalEdildi: "bg-zinc-500",
};

// Ağırlık puanı rozetinin rengi: sayıya bakmadan da işin ne kadar ağır
// olduğu anlaşılsın. Eşikler `tasks.weight_points` CHECK'i (1-100) içinde,
// pratikte kullanılan aralığa göre — 1-2 küçük iş, 11+ ise ayın taşıyıcısı.
// Tailwind derleme-zamanı tarayıcısı runtime'da üretilen string'leri
// yakalayamadığı için sınıflar burada LİTERAL yazılı (TASK_STATUS_BORDER_TOP
// ile aynı gerekçe).
export function taskWeightBadgeClass(points: number): string {
  if (points >= 11) return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200";
  if (points >= 6) return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
  if (points >= 3) return "bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-200";
  return "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
}

// Bir görevin "açık" (tamamlanmamış) sayılması için: yayınlanmamış olması.
export const OPEN_TASK_STATUSES: TaskStatus[] = TASK_STATUSES.filter(
  (s) => s !== "Yayinlandi",
);

// Tekrar eden görevler: arayüzdeki select ve action doğrulaması aynı listeyi
// kullansın diye tek yerde. Gün cinsinden — "aylık" 30 gün kabul ediliyor
// (takvim ayı değil; iç araç için yeterli, sürpriz yok).
export const REPEAT_OPTIONS: { days: number; label: string }[] = [
  { days: 0, label: "Tekrar yok" },
  { days: 7, label: "Haftalık" },
  { days: 14, label: "2 haftada bir" },
  { days: 30, label: "Aylık" },
];

export const TASK_PRIORITIES: TaskPriority[] = ["Dusuk", "Normal", "Yuksek", "Acil"];

export const TASK_DIFFICULTIES: TaskDifficulty[] = ["Kolay", "Orta", "Zor", "Ozel"];

export const TASK_DIFFICULTY_LABEL: Record<TaskDifficulty, string> = {
  Kolay: "Kolay",
  Orta: "Orta",
  Zor: "Zor",
  Ozel: "Özel",
};

export const TASK_DIFFICULTY_BADGE: Record<TaskDifficulty, string> = {
  Kolay: "border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  Orta: "border border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  Zor: "border border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-200",
  Ozel: "border border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
};

export const TASK_DELIVERY_STATUS_LABEL: Record<TaskDeliveryStatus, string> = {
  Beklemede: "Onay bekliyor",
  Onaylandi: "Onaylandı",
  RevizeIstendi: "Revize istendi",
};

export const TASK_DELIVERY_STATUS_BADGE: Record<TaskDeliveryStatus, string> = {
  Beklemede: "border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  Onaylandi: "border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  RevizeIstendi: "border border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
};

export const TASK_REVISION_REASONS: TaskRevisionReason[] = [
  "BriefDegisikligi",
  "MusteriDegisikligi",
  "Tasarim",
  "Metin",
  "Teknik",
  "Diger",
];

export const TASK_REVISION_REASON_LABEL: Record<TaskRevisionReason, string> = {
  BriefDegisikligi: "Brief değişikliği",
  MusteriDegisikligi: "Müşteri değişikliği",
  Tasarim: "Tasarım",
  Metin: "Metin",
  Teknik: "Teknik hata",
  Diger: "Diğer",
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  Dusuk: "Düşük",
  Normal: "Normal",
  Yuksek: "Yüksek",
  Acil: "Acil",
};

export const TASK_PRIORITY_ICON: Record<TaskPriority, string> = {
  Dusuk: "🔽",
  Normal: "▪️",
  Yuksek: "🔺",
  Acil: "🔥",
};

export const TASK_PRIORITY_BADGE: Record<TaskPriority, string> = {
  Dusuk:
    "border border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300",
  Normal:
    "border border-cyan-400 bg-cyan-50 text-cyan-800 dark:border-cyan-700 dark:bg-cyan-950 dark:text-cyan-200",
  Yuksek:
    "border border-orange-400 bg-orange-50 text-orange-800 dark:border-orange-600 dark:bg-orange-950 dark:text-orange-200",
  Acil:
    "border border-rose-500 bg-rose-50 text-rose-800 dark:border-rose-600 dark:bg-rose-950 dark:text-rose-200",
};

// Kanban kartlarında başlığın önüne sadece göz ardı edilmemesi gereken
// öncelikler için bayrak konur — Normal/Düşük görsel gürültü yaratmasın diye.
export const TASK_PRIORITY_FLAG_THRESHOLD: TaskPriority[] = ["Yuksek", "Acil"];

// Görev kartlarının TAM çerçevesindeki öncelik rengi. Renk tek başına anlam
// taşımıyor; kartın içinde ayrıca yazılı öncelik rozeti de gösteriliyor.
export const TASK_PRIORITY_BORDER: Record<TaskPriority, string> = {
  Dusuk: "border-slate-300 dark:border-slate-600",
  Normal: "border-cyan-400 dark:border-cyan-700",
  Yuksek: "border-orange-500 dark:border-orange-600",
  Acil: "border-rose-500 dark:border-rose-600",
};

// Takvim ızgarasının dar ekran görünümünde (metin pill'i sığmadığında) öncelik
// göstergesi — TASK_PRIORITY_BORDER ile aynı renk ailesi, TASK_STATUS_DOT ile
// aynı düz-nokta deseni. Tailwind'in derleme-zamanı taraması runtime'da
// üretilen sınıf adlarını yakalayamadığı için (bkz. TASK_STATUS_BORDER_TOP
// yorumu) burada da literal bir sözlük olarak yazılmalı.
export const TASK_PRIORITY_DOT: Record<TaskPriority, string> = {
  Dusuk: "bg-slate-300 dark:bg-slate-600",
  Normal: "bg-cyan-400 dark:bg-cyan-600",
  Yuksek: "bg-orange-500",
  Acil: "bg-rose-500",
};

// Rapor kartlarının ortak yüzeyi (çerçeve + zemin). Burada duruyor çünkü hem
// `CollapsiblePanel` hem `ReportPrimitives` kullanıyor; bileşenlerden birinde
// tanımlansaydı ikisi birbirini import edip döngü oluşturuyordu.
export const REPORT_SURFACE_CLASS =
  "report-surface rounded-2xl border border-border-default bg-surface";
