// Puan kataloğunun v1 tanımı.
//
// Kaynak: "intracker-puanlama-patch-v1.pdf" + 15 Eylül 2026 kullanıcı kararı.
// KULLANICI KARARI KAYNAK FORMÜLÜNÜ DEĞİŞTİRİR: puan tek tek tamamlanan
// görevlerden değil, BÜTÜNÜ teslim edilip ekipçe onaylanmış PAKETLERDEN
// kazanılır. Eksik paketin puanı 0'dır; kısmi/oransal puan yoktur.
//
// Bütün tutarlar tam sayı iç birimdir (1 puan = 20 birim, bkz. units.ts).
// "Birim iç değer" ADET BAŞINA değerdir; set toplamı adet × birim değerdir —
// kaynak PDF'te bu iki sütun aynı başlık altında karışıyordu.

// Relative + AÇIK `.ts` uzantısı: bu modül `lib/db/migrations.ts` üzerinden
// alias hook'u OLMADAN da yükleniyor (bkz. lib/db/client.ts'teki aynı gerekçe).
import { UNITS_PER_POINT } from "./units.ts";

export const POINT_CATALOG_VERSION = "v1";

/** Kişiye atanan puan profili. Departman adıyla AYNI olmak zorunda değil. */
export type PointProfile = "video" | "graphic" | "social" | "ai_artist";

export const POINT_PROFILES: PointProfile[] = ["video", "graphic", "social", "ai_artist"];

export const POINT_PROFILE_LABEL: Record<PointProfile, string> = {
  video: "Video ekibi",
  graphic: "Grafik tasarım",
  social: "Sosyal medya",
  ai_artist: "AI Artist & Videographer",
};

/**
 * Paketin kapsamı:
 *  - "brand": departman + MARKA + plan ayı + iş kalemi
 *  - "person": kişi + plan ayı + iş kalemi (AI'de marka ÇARPANI YOKTUR)
 */
export type PointScope = "brand" | "person";

export interface PointCatalogItem {
  profile: PointProfile;
  /** Katalog anahtarı — Video Reels ile AI Reels AYRI anahtarlardır. */
  key: string;
  label: string;
  scope: PointScope;
  /** Paketin tamamlanması için gereken adet. */
  requiredCount: number;
  /** ADET BAŞINA iç birim değeri. */
  unitUnits: number;
}

export const POINT_CATALOG_ITEMS: readonly PointCatalogItem[] = [
  // Video ekibi · marka başına set → 4×80 + 4×20 + 15×4 = 460 birim = 23 puan
  { profile: "video", key: "video.reels", label: "Reels", scope: "brand", requiredCount: 4, unitUnits: 80 },
  { profile: "video", key: "story_video", label: "Kısa story videosu", scope: "brand", requiredCount: 4, unitUnits: 20 },
  { profile: "video", key: "photo_edit", label: "Fotoğraf editi", scope: "brand", requiredCount: 15, unitUnits: 4 },

  // Grafik tasarım · marka başına set → 8×25 + 12×5 + 4×15 = 320 birim = 16 puan
  { profile: "graphic", key: "graphic.post", label: "Post", scope: "brand", requiredCount: 8, unitUnits: 25 },
  { profile: "graphic", key: "graphic.story", label: "Story", scope: "brand", requiredCount: 12, unitUnits: 5 },
  { profile: "graphic", key: "reels_cover", label: "Reels kapağı", scope: "brand", requiredCount: 4, unitUnits: 15 },

  // Sosyal medya · marka başına set → 120 + 60 + 45 = 225 birim = 11,25 puan
  { profile: "social", key: "content_plan", label: "İçerik planı", scope: "brand", requiredCount: 1, unitUnits: 120 },
  { profile: "social", key: "technical", label: "Teknik", scope: "brand", requiredCount: 1, unitUnits: 60 },
  { profile: "social", key: "reporting", label: "Raporlama", scope: "brand", requiredCount: 1, unitUnits: 45 },

  // AI Artist & Videographer · KİŞİ başına aylık set → 1.000 + 500 + 300 = 1.800 = 90 puan
  // Bu set marka sayısıyla ÇARPILMAZ; marka göreve bağlanabilir ama kota kişi bazındadır.
  { profile: "ai_artist", key: "ai_artist.reels", label: "Reels (AI rolü)", scope: "person", requiredCount: 10, unitUnits: 100 },
  { profile: "ai_artist", key: "ai_video", label: "YZ üretim videosu", scope: "person", requiredCount: 10, unitUnits: 50 },
  { profile: "ai_artist", key: "ai_image", label: "YZ görsel üretimi", scope: "person", requiredCount: 30, unitUnits: 10 },
];

/** Ek puan havuzu: pakete bağlı DEĞİL, olay başına yazılır. */
export interface ExtraPointItem {
  key: string;
  label: string;
  /** Sabit tutar (iç birim). `null` = yönetici serbest tutarı. */
  units: number | null;
  /** Aynı hakkın iki kez yazılmasını engelleyen tekilleştirme kuralı. */
  uniqueness: "person-day" | "person-event" | "person-idea" | "delivery" | "none";
  note: string;
}

export const EXTRA_POINT_ITEMS: readonly ExtraPointItem[] = [
  { key: "shoot", label: "Çekim", units: 200, uniqueness: "person-day", note: "Kişi + yerel takvim günü başına tek 10 puan; gün bölünmez, aynı gün farklı markalarla çoğaltılmaz." },
  { key: "brand_onboarding", label: "Onboarding", units: 100, uniqueness: "delivery", note: "Set teslim ve onay ile; kendi teslim kimliğiyle tekilleşir." },
  { key: "applied_idea", label: "Uygulanan fikir", units: 100, uniqueness: "person-idea", note: "Yalnız hayata geçmiş fikir. Fikir bankasına satır eklemek puan kazandırmaz." },
  { key: "extra_reels", label: "Plan dışı ekstra Reels", units: 80, uniqueness: "delivery", note: "Temel setin DIŞINDA; aynı çıktı hem pakete hem buraya yazılmaz." },
  { key: "client_meeting", label: "Müşteri toplantısı", units: 40, uniqueness: "person-event", note: "Toplantı başına." },
  { key: "script_writing", label: "Senaryo / storyboard", units: 40, uniqueness: "delivery", note: "Derleme başına." },
  { key: "trend_analysis", label: "Rakip / trend analizi", units: 40, uniqueness: "delivery", note: "Sunum başına." },
  // Kazanılmış toplamda tavan olmaması, HER kalemin fiyatının serbest olduğu
  // anlamına gelmez: serbest tutarlı TEK kalem budur, diğerleri sabit fiyat ×
  // doğrulanmış adettir.
  { key: "manager_review", label: "Yönetici görüşü", units: null, uniqueness: "none", note: "Manuel; açıklama zorunlu." },
];

export function extraPointItem(key: string): ExtraPointItem | undefined {
  return EXTRA_POINT_ITEMS.find((item) => item.key === key);
}

export function catalogItem(profile: PointProfile, key: string): PointCatalogItem | undefined {
  return POINT_CATALOG_ITEMS.find((item) => item.profile === profile && item.key === key);
}

export function catalogItemsForProfile(profile: PointProfile): PointCatalogItem[] {
  return POINT_CATALOG_ITEMS.filter((item) => item.profile === profile);
}

/** Bir kalemin TAM paketi tamamlandığında doğan tutar (iç birim). */
export function packageUnitsFor(item: PointCatalogItem): number {
  return item.requiredCount * item.unitUnits;
}

/**
 * Profilin tek bir kapsam (marka ya da kişi-ay) için toplam set değeri.
 * Türetilmiş toplam KODDA hesaplanıyor; ayrı bir sabit tutulsaydı katalog
 * değişince ikisi birbirinden sessizce kopardı.
 */
export function profileSetUnits(profile: PointProfile): number {
  return catalogItemsForProfile(profile).reduce((sum, item) => sum + packageUnitsFor(item), 0);
}

/** Katalogdaki aylık kişi hedefi. Marka sayısına göre oranlama YAPILMIYOR. */
export const MONTHLY_TARGET_POINTS = 100;
export const MONTHLY_TARGET_UNITS = MONTHLY_TARGET_POINTS * UNITS_PER_POINT;

/**
 * REFERANS marka sayıları — atama ya da gizli çarpan DEĞİL. Yalnızca
 * "katalog bu marka sayısıyla kaç puan eder" sorusunu cevaplayan bir okuma
 * yardımcısıdır; paketler gerçekten seçilen markalarla oluşturulur.
 */
export const REFERENCE_BRAND_COUNTS: Readonly<Record<PointProfile, number>> = {
  video: 4,
  graphic: 6,
  social: 8,
  ai_artist: 1,
};

export function isPointProfile(value: unknown): value is PointProfile {
  return typeof value === "string" && (POINT_PROFILES as string[]).includes(value);
}
