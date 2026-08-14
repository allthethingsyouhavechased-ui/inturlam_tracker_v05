import fs from "node:fs";
import path from "node:path";
import { getDb } from "../lib/db/client.ts";

// id = Instagram handle. name = görünen ad (gerekirse düzenle ve tekrar çalıştır).
const BRANDS: { id: string; name: string; cluster: string }[] = [
  // Balık & Deniz
  { id: "sihirliolta", name: "Sihirli Olta", cluster: "balik-deniz" },
  { id: "ns.blackhole", name: "N.S Black Hole", cluster: "balik-deniz" },
  { id: "travellabbalikturu", name: "Travellab Balık Turu", cluster: "balik-deniz" },
  { id: "cengizbalikcilik", name: "Cengiz Balıkçılık", cluster: "balik-deniz" },
  { id: "arkaymarine", name: "Arkay Marine", cluster: "balik-deniz" },
  { id: "tersanmarine", name: "Tersan Marine", cluster: "balik-deniz" },
  // Kahve & Gıda
  { id: "hacibabacoffee", name: "Hacıbaba Coffee House", cluster: "kahve-gida" },
  { id: "kahvecihb", name: "Kahveci Hacıbaba", cluster: "kahve-gida" },
  { id: "pellegrocaffe", name: "Pellegro Caffè", cluster: "kahve-gida" },
  { id: "justcafejust", name: "Just Cafe", cluster: "kahve-gida" },
  { id: "hbkuruyemis", name: "Hacıbaba Kuruyemiş", cluster: "kahve-gida" },
  // B2B / Yapı
  { id: "ateknikyalitim", name: "A Teknik Yalıtım", cluster: "b2b-yapi" },
  { id: "antek_makina", name: "Antek", cluster: "b2b-yapi" },
  { id: "ozanparke", name: "Ozan Parke", cluster: "b2b-yapi" },
  { id: "adadisticaret", name: "ADA Dış Ticaret", cluster: "b2b-yapi" },
  // Hamam
  { id: "alaaddinhammam", name: "Alaaddin Hamam", cluster: "hamam" },
  { id: "buyukhammam", name: "Nicosia Grand Turkish Bath", cluster: "hamam" },
  // Gayrimenkul
  { id: "theprivefethiye", name: "The Privé Fethiye", cluster: "emlak" },
  // Diğer
  { id: "famedans", name: "Fame Dans Stüdyosu", cluster: "tek" },
];

// Yeni biri katılırsa buraya ekle, id sabit kalsın diye isim değişse de dursun.
// `department` değerleri lib/departments.ts'teki DEPARTMENTS id'leridir. Yalnızca
// kişi ilk kez yazılırken (ve sonradan boş kalmışsa) uygulanır — arayüzden
// yapılan departman değişikliğini seed geri almaz (bkz. insertPerson).
const PEOPLE: { id: string; name: string; department: string | null; isManager: boolean }[] = [
  { id: "yunus", name: "Yunus Emre", department: "video", isManager: true },
  { id: "arman", name: "Arman", department: "video", isManager: false },
  { id: "berkant", name: "Berkant", department: "management", isManager: true },
  { id: "cansu", name: "Cansu", department: "social", isManager: false },
  { id: "defne", name: "Defne", department: "social", isManager: false },
  { id: "ekin", name: "Ekin", department: "design", isManager: false },
  { id: "emrullah", name: "Emrullah", department: "video", isManager: false },
  { id: "erhan", name: "Erhan", department: "video", isManager: true },
  { id: "murat", name: "Murat", department: "design", isManager: false },
  { id: "ozgun", name: "Özgün", department: "video", isManager: false },
  { id: "ozgur", name: "Özgür", department: "management", isManager: true },
  { id: "sila", name: "Sıla", department: "design", isManager: true },
];

// Artık kullanılmayan placeholder kişiler — hiçbir görev/yoruma bağlı değillerse
// tamamen silinir (FK varsa bu adım hata vermez, ama bu ikisi için kontrol edildi).
const REMOVED_PEOPLE_IDS = ["kisi-2", "kisi-3"];

// "İNTURLAM Portföy Denetimi — Sentez" artifact'inden (22 Temmuz 2026) — takipçi,
// gönderi, medyan Reel izlenmesi, kapak testi, öne çıkan bulgu, ilk aksiyon.
type CoverTestVerdict = "Gecti" | "Kismen" | "Basarisiz" | "Sinirda";
const BRAND_STATS: Record<
  string,
  {
    followerCount: number;
    postCount: number;
    medianReelViews: string;
    coverTestVerdict: CoverTestVerdict;
    coverTestNote?: string;
    keyFinding: string;
    firstAction: string;
    tier?: string;
  }
> = {
  adadisticaret: {
    followerCount: 1097, postCount: 187, medianReelViews: "1.100",
    coverTestVerdict: "Sinirda",
    keyFinding: "İçeriğin %60'ı tedarikçi ürünü; 3 gönderi ~2,6M izlenme ama 2-9 yorum (boost göstergesi)",
    firstAction: "Highlight mimarisi kur",
  },
  ateknikyalitim: {
    followerCount: 1295, postCount: 161, medianReelViews: "1.400",
    coverTestVerdict: "Gecti",
    keyFinding: "Eğitim/karar-desteği içeriği güçlü; ADA ile slogan örtüşmesi",
    firstAction: "'Temelden çatıya' ifadesini netleştir",
  },
  antek_makina: {
    followerCount: 48, postCount: 25, medianReelViews: "677",
    coverTestVerdict: "Basarisiz",
    keyFinding: "%90 jenerik bayram tebriği; gerçek EPC yetkinliği (feasibility→commissioning) gösterilmiyor; 0 highlight",
    firstAction: "Gerçek saha/proje içeriği üret",
  },
  ozanparke: {
    followerCount: 27100, postCount: 982, medianReelViews: "~1.765 (+3 viral: 134B–510B)",
    coverTestVerdict: "Gecti", coverTestNote: "portföyün en güçlüsü",
    keyFinding: "T.C. Cumhurbaşkanlığı referans projesi tek gönderide gömülü kalmış",
    firstAction: "Prestij projelerini highlight'a taşı",
  },
  alaaddinhammam: {
    followerCount: 1784, postCount: 132, medianReelViews: "~23.000",
    coverTestVerdict: "Gecti", coverTestNote: "açık farkla",
    keyFinding: "Portföyün en istikrarlı organik performansı; rezervasyon linki yok",
    firstAction: "Bio'ya doğrudan booking linki ekle",
  },
  buyukhammam: {
    followerCount: 7670, postCount: 308, medianReelViews: "8.525",
    coverTestVerdict: "Gecti",
    keyFinding: "Alaaddin Hamam'ın kardeş şubesi; son 5 reel 620–1.242'ye çökmüş, tarihsel medyanın çok altında",
    firstAction: "Düşüşün nedenini araştır (algoritma/kapak/reklam kesintisi)",
  },
  cengizbalikcilik: {
    followerCount: 15000, postCount: 856, medianReelViews: "246.000",
    coverTestVerdict: "Gecti",
    keyFinding: "Portföyün en iyi performansı ve en organik topluluğu — ama 0 highlight",
    firstAction: "Highlight kur, 'Kutu Açma'yı resmi seriye çevir",
  },
  "ns.blackhole": {
    followerCount: 6489, postCount: 135, medianReelViews: "12.700",
    coverTestVerdict: "Gecti",
    keyFinding: "431B izlenmeli reelde 3 yanıtsız fiyat sorusu",
    firstAction: "Fiyat/nereden-alınır bilgisini sabitle",
  },
  tersanmarine: {
    followerCount: 7988, postCount: 414, medianReelViews: "7.013",
    coverTestVerdict: "Gecti",
    keyFinding: "İki viral travel-lift videosu (905B / 934B)",
    firstAction: "Formatı düzenli bir seriye bağla",
  },
  arkaymarine: {
    followerCount: 18500, postCount: 727, medianReelViews: "5.835",
    coverTestVerdict: "Gecti",
    keyFinding: "13 highlight kategorisi var ama üst grup yok",
    firstAction: "Highlight'ları üst kategoriye grupla",
  },
  sihirliolta: {
    followerCount: 11900, postCount: 810, medianReelViews: "5.100",
    coverTestVerdict: "Kismen",
    keyFinding: "Cengiz Balıkçılık ile doğrudan rekabet; yanıtsız satın alma sinyalleri",
    firstAction: "Yorumlardaki fiyat/yardım sorularına yanıt ver",
  },
  travellabbalikturu: {
    followerCount: 5775, postCount: 387, medianReelViews: "3.435",
    coverTestVerdict: "Gecti",
    keyFinding: "Portföyün en şeffaf fiyatlandırması — iyi pratik örneği",
    firstAction: "Rezervasyon SSS'lerini highlight'a ekle",
  },
  pellegrocaffe: {
    followerCount: 5121, postCount: 70, medianReelViews: "~2.556 (+4 influencer: 31B–551B)",
    coverTestVerdict: "Gecti",
    keyFinding: "Pinler hâlâ 'çok yakında' — marka artık 2 şubeli",
    firstAction: "Pinlenmiş gönderileri güncelle",
  },
  justcafejust: {
    followerCount: 1051, postCount: 522, medianReelViews: "602",
    coverTestVerdict: "Kismen",
    keyFinding: "En iyi performans ürün fotoğrafından değil 'Bi'Aile Meselesi' insan-içeriğinden",
    firstAction: "Formatı sistematik seriye çevir",
  },
  hbkuruyemis: {
    followerCount: 4211, postCount: 621, medianReelViews: "565",
    coverTestVerdict: "Gecti",
    keyFinding: "Hacıbaba ailesinin bir alt markası; 0 takip — portföyün en izole hesabı",
    firstAction: "Aile bağını bio/highlight'ta görünür kıl",
  },
  hacibabacoffee: {
    followerCount: 317, postCount: 6, medianReelViews: "n=3 (163B / 1M / 1,3M)",
    coverTestVerdict: "Gecti", coverTestNote: "yeni lansman",
    keyFinding: "2,46M izlenme / 317 takipçi — devasa dönüşüm boşluğu; ailenin köklü kardeşinden henüz yararlanmıyor",
    firstAction: "Reels'i marka/ürüne görsel olarak bağla",
  },
  kahvecihb: {
    followerCount: 11900, postCount: 936, medianReelViews: "713",
    coverTestVerdict: "Gecti",
    keyFinding: "Ailenin en köklü üyesi (2003'ten beri, 9 şube) ama aile bağı hiçbir yerde görünmüyor; 9 şubeye rağmen bio'da şube listesi yok",
    firstAction: "Aile bağını ve şube listesini bio/highlight'ta görünür kıl",
  },
  theprivefethiye: {
    followerCount: 1474, postCount: 168, medianReelViews: "~2.650 (+9 boost: 32,4B–2,3Mn)",
    coverTestVerdict: "Gecti",
    keyFinding: "PrivéStrong highlight'ı zemin/jet-grout mühendisliğini paylaşıyor (nadir güven sinyali); pinlenmiş gönderide 8 yorumun 7'si yanıtsız fiyat sorusu",
    firstAction: "Fiyat/SSS highlight'ı aç, yorumlara şablon yanıt ver",
    tier: "B",
  },
  famedans: {
    followerCount: 8692, postCount: 1082, medianReelViews: "7.222",
    coverTestVerdict: "Kismen",
    keyFinding: "Dünya Şampiyonası + London College of Music sertifikası tek gönderide gömülü",
    firstAction: "Kanıt/başarı içerik sütunu kur",
  },
};

type RelationType =
  | "rakip" | "tedarikci" | "ortaklik_muhtemel" | "kismi_cakisma"
  | "portfoy_ici" | "marka_ailesi" | "kardes_sube" | "nuansli";
type RelationRisk = "yuksek" | "dusuk" | "yok";

const BRAND_RELATIONS: {
  brandId: string; relatedBrandId: string; type: RelationType;
  risk: RelationRisk; note: string;
}[] = [
  { brandId: "sihirliolta", relatedBrandId: "cengizbalikcilik", type: "rakip", risk: "yuksek",
    note: "Aynı iş modeli (uluslararası balıkçılık ekipmanı distribütörlüğü/perakendesi), aynı müşteri kitlesi. Medyan Reel izlenmesinde ~48x fark." },
  { brandId: "adadisticaret", relatedBrandId: "ateknikyalitim", type: "nuansli", risk: "dusuk",
    note: "Muhtemelen tedarikçi/uygulayıcı ilişkisi, doğrudan rakip değil — ama ortak slogan ('Temelden çatıya') belirsizlik yaratıyor." },
  { brandId: "justcafejust", relatedBrandId: "pellegrocaffe", type: "nuansli", risk: "dusuk",
    note: "Her ikisi de pizza satıyor, Çankaya/Ankara bölgesinde — konsept ve fiyat segmenti farklı." },
  { brandId: "ns.blackhole", relatedBrandId: "sihirliolta", type: "tedarikci", risk: "yok",
    note: "Kanıtlandı: üretici → Türkiye distribütörü ilişkisi, en az 5 gönderi birebir paylaşılıyor." },
  { brandId: "travellabbalikturu", relatedBrandId: "cengizbalikcilik", type: "ortaklik_muhtemel", risk: "yok",
    note: "Doğrudan etiketleme var (Mısır/Giant Trevally içeriği) — yerel kılavuzluk ilişkisi olabilir." },
  { brandId: "arkaymarine", relatedBrandId: "sihirliolta", type: "kismi_cakisma", risk: "dusuk",
    note: "Shimano üzerinden ortak tedarikçi markası — Arkay Marine'in iş modeli daha geniş (tekne/motor/dalış) olduğu için tam çakışma değil." },
  { brandId: "arkaymarine", relatedBrandId: "cengizbalikcilik", type: "kismi_cakisma", risk: "dusuk",
    note: "Shimano üzerinden ortak tedarikçi markası — tam çakışma değil." },
  { brandId: "theprivefethiye", relatedBrandId: "arkaymarine", type: "portfoy_ici", risk: "yok",
    note: "Arkay Marine, The Privé Fethiye'yi takip ediyor — iki farklı kümede, rekabetsiz, çapraz tanıtım için kullanılabilecek bir bağ." },
  { brandId: "kahvecihb", relatedBrandId: "hacibabacoffee", type: "marka_ailesi", risk: "dusuk",
    note: "Aynı 'Hacıbaba' ailesinin alt markaları, operasyonel olarak ayrı işletmeler. Bağ şu an bio/highlight'ta görünmüyor." },
  { brandId: "kahvecihb", relatedBrandId: "hbkuruyemis", type: "marka_ailesi", risk: "dusuk",
    note: "Aynı 'Hacıbaba' ailesinin alt markaları, operasyonel olarak ayrı işletmeler." },
  { brandId: "hacibabacoffee", relatedBrandId: "hbkuruyemis", type: "marka_ailesi", risk: "dusuk",
    note: "Aynı 'Hacıbaba' ailesinin alt markaları, operasyonel olarak ayrı işletmeler." },
  { brandId: "alaaddinhammam", relatedBrandId: "buyukhammam", type: "kardes_sube", risk: "yok",
    note: "Aynı ailenin iki şubesi (Kapadokya ↔ Kıbrıs) — paylaşılan kimlik formülü ve dil bilinçli bir seçim, çakışma değil." },
];

// Vault'taki tam 7-katmanlı denetim dosyalarını bulur ve okur. Drive bağlı değilse
// (ör. bu makine dışında bir yerde çalıştırılırsa) sessizce boş liste döner — seed'in
// geri kalanı yine de çalışır, sadece "Tam Denetim" bölümü boş kalır.
function findVaultDir(): string | null {
  const known = `G:\\Drive'ım\\Obsidian Vault (Ofis PC)\\Kariyer\\INTURLAM\\Marka Denetimleri`;
  if (fs.existsSync(known)) return known;
  for (const letter of "DEFHIJKLMNOPQRSTUVWXYZ") {
    const p = `${letter}:\\Drive'ım\\Obsidian Vault (Ofis PC)\\Kariyer\\INTURLAM\\Marka Denetimleri`;
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadAudits(): { brandId: string; body: string; sourceFile: string }[] {
  const dir = findVaultDir();
  if (!dir) {
    console.warn("Vault bulunamadı (G: sürücüsü bağlı değil) — tam denetim metinleri atlanıyor.");
    return [];
  }
  const results: { brandId: string; body: string; sourceFile: string }[] = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const raw = fs.readFileSync(path.join(dir, file), "utf-8");
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) continue;
    const handleMatch = match[1].match(/^handle:\s*(\S+)/m);
    if (!handleMatch) continue;
    results.push({ brandId: handleMatch[1], body: match[2].trim(), sourceFile: file });
  }
  return results;
}

// Logo dosya adı = handle (id) birebir aynı, `public/logos/<id>.jpg` altında.
// Elle eşleştirme gerekmiyor: dosya varsa otomatik bağlanır, yoksa BrandLogo
// component'i baş-harf fallback'ine döner.
const LOGO_DIR = path.join(process.cwd(), "public", "logos");
function resolveLogoPath(id: string): string | null {
  return fs.existsSync(path.join(LOGO_DIR, `${id}.jpg`)) ? `/logos/${id}.jpg` : null;
}

const db = getDb();

const insertBrand = db.prepare(
  `INSERT INTO brands (
     id, name, cluster, sort_order, instagram_handle,
     follower_count, post_count, median_reel_views,
     cover_test_verdict, cover_test_note, key_finding, first_action, tier, logo_path
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(id) DO UPDATE SET
     name = excluded.name, cluster = excluded.cluster, sort_order = excluded.sort_order,
     instagram_handle = excluded.instagram_handle,
     follower_count = excluded.follower_count, post_count = excluded.post_count,
     median_reel_views = excluded.median_reel_views,
     cover_test_verdict = excluded.cover_test_verdict, cover_test_note = excluded.cover_test_note,
     key_finding = excluded.key_finding, first_action = excluded.first_action, tier = excluded.tier,
     logo_path = excluded.logo_path`,
);
let logosLinked = 0;
BRANDS.forEach((b, i) => {
  const stats = BRAND_STATS[b.id];
  const logoPath = resolveLogoPath(b.id);
  if (logoPath) logosLinked++;
  insertBrand.run(
    b.id, b.name, b.cluster, i, b.id,
    stats?.followerCount ?? null, stats?.postCount ?? null, stats?.medianReelViews ?? null,
    stats?.coverTestVerdict ?? null, stats?.coverTestNote ?? null,
    stats?.keyFinding ?? null, stats?.firstAction ?? null, stats?.tier ?? null, logoPath,
  );
});

// Departman ÜZERİNE YAZILMAZ: kişi zaten varsa yalnızca adı tazelenir, departman
// da sadece boşsa doldurulur. Aksi halde arayüzden yapılan her departman
// değişikliği bir sonraki seed'de sessizce geri alınırdı.
// Kullanıcı adı da departman gibi ÜZERİNE YAZILMAZ: seed'deki varsayılan kişi
// id'sidir, ama ekip yönetiminden değiştirilmiş olabilir — COALESCE ile yalnızca
// boşsa doldurulur.
const insertPerson = db.prepare(
  `INSERT INTO people (id, username, name, department, is_manager) VALUES (?, ?, ?, ?, ?)
   ON CONFLICT(id) DO UPDATE SET
     name = excluded.name,
     username = COALESCE(people.username, excluded.username),
     department = COALESCE(people.department, excluded.department),
     is_manager = MAX(people.is_manager, excluded.is_manager)`,
);
for (const p of PEOPLE) {
  insertPerson.run(p.id, p.id.toLowerCase(), p.name, p.department, p.isManager ? 1 : 0);
}

const deletePerson = db.prepare(`DELETE FROM people WHERE id = ?`);
for (const id of REMOVED_PEOPLE_IDS) deletePerson.run(id);

// İlişkiler her çalıştırmada temizlenip yeniden yazılır — kaynak sabit veri, drift olmaz.
db.exec("DELETE FROM brand_relations");
const insertRelation = db.prepare(
  `INSERT INTO brand_relations (id, brand_id, related_brand_id, relation_type, risk_level, note)
   VALUES (?, ?, ?, ?, ?, ?)`,
);
for (const r of BRAND_RELATIONS) {
  insertRelation.run(`${r.brandId}__${r.relatedBrandId}`, r.brandId, r.relatedBrandId, r.type, r.risk, r.note);
}

const audits = loadAudits();
const insertAudit = db.prepare(
  `INSERT INTO brand_audits (brand_id, body_markdown, source_file, audit_date)
   VALUES (?, ?, ?, datetime('now'))
   ON CONFLICT(brand_id) DO UPDATE SET
     body_markdown = excluded.body_markdown, source_file = excluded.source_file,
     audit_date = excluded.audit_date, updated_at = datetime('now')`,
);
let auditsWritten = 0;
for (const a of audits) {
  if (!BRAND_STATS[a.brandId] && !BRANDS.some((b) => b.id === a.brandId)) continue; // bilinmeyen handle, atla
  insertAudit.run(a.brandId, a.body, a.sourceFile);
  auditsWritten++;
}

const brandCount = db.prepare("SELECT COUNT(*) AS n FROM brands").get() as { n: number };
const peopleCount = db.prepare("SELECT COUNT(*) AS n FROM people").get() as { n: number };
const relationCount = db.prepare("SELECT COUNT(*) AS n FROM brand_relations").get() as { n: number };

console.log(
  `Seed tamam → ${brandCount.n} marka, ${peopleCount.n} kişi, ${relationCount.n} ilişki, ${auditsWritten} tam denetim metni, ${logosLinked} logo.`,
);
