// Demo/test verisi: markalara gerçekçi içerik (proje) ve görev kayıtları açar.
// Uygulamayı elle gezerek test edebilmek için — gerçek iş verisi DEĞİL.
//
// Çalıştırma:  npm run db:seed:demo
// Temizleme:   npm run db:seed:demo -- --clean   (sadece siler, yeniden yazmaz)
//
// Tüm kayıtların id'si `demo-` ile başlar; script her çalıştığında önce bu
// kayıtları silip yeniden yazar (idempotent). Böylece gerçek verilere hiç
// dokunulmaz ve demo verisi tek komutla kaldırılabilir. Görevler/yorumlar
// content_items'a FK + ON DELETE CASCADE ile bağlı olduğu için içerikleri
// silmek alt kayıtları da düşürür.
//
// Tarihler bugüne göre GÖRELİ üretiliyor (gün ofseti) — script'i haftalar sonra
// tekrar çalıştırınca "gecikmiş" / "bu hafta teslim" panoları yine dolu olsun.

import { getDb } from "../lib/db/client.ts";

const CLEAN_ONLY = process.argv.includes("--clean");

const MS_PER_DAY = 86_400_000;

// Bugüne göre `offset` gün sonrası → 'YYYY-MM-DD'. Negatif = geçmiş (gecikmiş).
function day(offset: number): string {
  return new Date(Date.now() + offset * MS_PER_DAY).toISOString().slice(0, 10);
}

// activity_log.created_at SQLite'ın datetime('now') formatında (UTC) tutuluyor.
function ts(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 3_600_000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

// calendar_events.start_at/end_at saatli etkinliklerde TAM ISO (UTC) — takvim
// ekranı bunu yerel saate çeviriyor (bkz. lib/calendar/time.ts). `hour` yerel
// İstanbul saati kabul edilir, UTC+3 çıkarılarak yazılır.
function isoAt(dayOffset: number, hour: number): string {
  const date = new Date(Date.now() + dayOffset * MS_PER_DAY);
  date.setUTCHours(hour - 3, 0, 0, 0);
  return date.toISOString();
}

type ContentType =
  | "Reel"
  | "Post"
  | "Story"
  | "Foto"
  | "Kampanya"
  | "Video"
  | "Carousel"
  | "KurumsalKimlik"
  | "Diger";
type ContentStatus = "Planlandi" | "Uretimde" | "Tamamlandi" | "IptalEdildi";
type TaskStatus = "Beklemede" | "DevamEdiyor" | "Incelemede" | "Onaylandi" | "Yayinlandi";
type TaskPriority = "Dusuk" | "Normal" | "Yuksek" | "Acil";
type TaskDifficulty = "Kolay" | "Orta" | "Zor" | "Ozel";

interface DemoTask {
  slug: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string | null;
  due: number | null; // bugüne göre gün ofseti
  notes?: string;
}

// Zorluk/puan görev görev yazılmıyor: 41 satırı elle doldurmak listeyi okunmaz
// hale getirirdi ve rastgele değer her çalıştırmada başka sonuç üretirdi.
// Bunun yerine görev SIRASINA bağlı sabit bir döngü — hem çeşitli hem
// tekrarlanabilir. "Ozel" bilerek seyrek.
const DIFFICULTY_CYCLE: TaskDifficulty[] = [
  "Orta", "Kolay", "Zor", "Orta", "Kolay", "Orta", "Zor", "Ozel",
];
const WEIGHT_BY_DIFFICULTY: Record<TaskDifficulty, number> = {
  Kolay: 1,
  Orta: 3,
  Zor: 8,
  Ozel: 5,
};

function difficultyFor(index: number): TaskDifficulty {
  return DIFFICULTY_CYCLE[index % DIFFICULTY_CYCLE.length];
}

/** Aynı zorluktaki işler de birbirinin kopyası olmasın diye 0/+1/+2 sapma. */
function weightFor(index: number, difficulty: TaskDifficulty): number {
  return WEIGHT_BY_DIFFICULTY[difficulty] + (index % 3);
}

interface DemoContent {
  slug: string;
  brandId: string;
  title: string;
  type: ContentType;
  status: ContentStatus;
  assignee: string | null;
  target: number | null;
  archived?: boolean;
  tasks: DemoTask[];
}

// Ekipten gerçek kişi id'leri (db/seed.mts'teki PEOPLE listesi).
const CONTENT: DemoContent[] = [
  // ---- Balık & Deniz ----
  {
    slug: "sihirliolta-agustos-reel",
    brandId: "sihirliolta",
    title: "Ağustos Reel Serisi — Olta Teknikleri",
    type: "Reel",
    status: "Uretimde",
    assignee: "ekin",
    target: 6,
    tasks: [
      {
        slug: "brief",
        title: "Seri konseptini ve 6 bölümün başlıklarını çıkar",
        status: "Yayinlandi",
        priority: "Normal",
        assignee: "ekin",
        due: -9,
      },
      {
        slug: "cekim",
        title: "1–3. bölüm çekimi (tekne, sabah kuşağı)",
        status: "Incelemede",
        priority: "Yuksek",
        assignee: "murat",
        due: -2,
        notes: "Ham kayıtlar Drive'da: /Sihirli Olta/Ağustos/RAW",
      },
      {
        slug: "kurgu",
        title: "1. bölüm kurgu + altyazı",
        status: "DevamEdiyor",
        priority: "Yuksek",
        assignee: "arman",
        due: 0,
      },
      {
        slug: "kapak",
        title: "Kapak görselleri (kapak testi başarısızdı, yeniden)",
        status: "Beklemede",
        priority: "Acil",
        assignee: "defne",
        due: 1,
        notes: "Denetimde kapak testi 'Başarısız' çıktı — yüz + büyük tipografi şart.",
      },
      {
        slug: "takvim",
        title: "Yayın takvimini onaya sun",
        status: "Beklemede",
        priority: "Dusuk",
        assignee: "yunus",
        due: 4,
      },
    ],
  },
  {
    slug: "blackhole-tekne-tanitim",
    brandId: "ns.blackhole",
    title: "Tekne Turu Tanıtım Videosu",
    type: "Video",
    status: "Planlandi",
    assignee: "murat",
    target: 18,
    tasks: [
      {
        slug: "senaryo",
        title: "60 sn'lik senaryo taslağı",
        status: "DevamEdiyor",
        priority: "Normal",
        assignee: "sila",
        due: 3,
      },
      {
        slug: "lokasyon",
        title: "Çekim için tekne ve gün ayarla",
        status: "Beklemede",
        priority: "Yuksek",
        assignee: "murat",
        due: 7,
      },
      {
        slug: "muzik",
        title: "Telifsiz müzik seçenekleri hazırla",
        status: "Beklemede",
        priority: "Dusuk",
        assignee: null,
        due: null,
      },
    ],
  },
  {
    slug: "cengiz-tezgah-foto",
    brandId: "cengizbalikcilik",
    title: "Günlük Tezgah Fotoğraf Seti",
    type: "Foto",
    status: "Uretimde",
    assignee: "defne",
    target: 2,
    tasks: [
      {
        slug: "cekim",
        title: "Sabah tezgah çekimi (haftalık tekrar)",
        status: "Onaylandi",
        priority: "Normal",
        assignee: "defne",
        due: -1,
      },
      {
        slug: "retus",
        title: "Renk düzeltme + 12 kare seçimi",
        status: "DevamEdiyor",
        priority: "Normal",
        assignee: "cansu",
        due: 1,
      },
      {
        slug: "metin",
        title: "Günlük fiyat/stok metin şablonu yaz",
        status: "Beklemede",
        priority: "Dusuk",
        assignee: "sila",
        due: 5,
      },
    ],
  },
  {
    slug: "tersan-fuar-kimlik",
    brandId: "tersanmarine",
    title: "Fuar Kataloğu & Kurumsal Kimlik Revizyonu",
    type: "KurumsalKimlik",
    status: "Planlandi",
    assignee: "ozgun",
    target: 25,
    tasks: [
      {
        slug: "envanter",
        title: "Mevcut kimlik dosyalarını topla (logo, font, renk)",
        status: "Yayinlandi",
        priority: "Normal",
        assignee: "ozgun",
        due: -12,
      },
      {
        slug: "moodboard",
        title: "Moodboard ve 3 yön sun",
        status: "Incelemede",
        priority: "Yuksek",
        assignee: "ozgun",
        due: -3,
        notes: "Müşteri 2. yönü beğendi ama 'daha teknik' istedi.",
      },
      {
        slug: "katalog",
        title: "16 sayfalık katalog şablonu",
        status: "Beklemede",
        priority: "Normal",
        assignee: "cansu",
        due: 12,
      },
    ],
  },

  // ---- Kahve & Gıda ----
  {
    slug: "hacibaba-soguk-kahve",
    brandId: "hacibabacoffee",
    title: "Soğuk Kahve Kampanyası",
    type: "Kampanya",
    status: "Uretimde",
    assignee: "cansu",
    target: 8,
    tasks: [
      {
        slug: "konsept",
        title: "Kampanya konsepti ve slogan",
        status: "Yayinlandi",
        priority: "Yuksek",
        assignee: "sila",
        due: -14,
      },
      {
        slug: "urun-cekim",
        title: "Ürün çekimi — 4 içecek, stüdyo",
        status: "Onaylandi",
        priority: "Yuksek",
        assignee: "defne",
        due: -4,
      },
      {
        slug: "reels",
        title: "3 adet Reel kurgusu",
        status: "DevamEdiyor",
        priority: "Acil",
        assignee: "arman",
        due: 0,
        notes: "Kampanya pazartesi başlıyor, kurgu bugün bitmeli.",
      },
      {
        slug: "story",
        title: "Story şablonları (indirim kodu)",
        status: "Beklemede",
        priority: "Normal",
        assignee: "cansu",
        due: 1,
      },
      {
        slug: "raporlama",
        title: "İlk hafta performans raporu",
        status: "Beklemede",
        priority: "Dusuk",
        assignee: "yunus",
        due: 15,
      },
    ],
  },
  {
    slug: "kahvecihb-menu-cekim",
    brandId: "kahvecihb",
    title: "Menü Çekimi Yenileme",
    type: "Foto",
    status: "Tamamlandi",
    assignee: "defne",
    target: -6,
    tasks: [
      {
        slug: "cekim",
        title: "Menü çekimi (28 ürün)",
        status: "Yayinlandi",
        priority: "Normal",
        assignee: "defne",
        due: -8,
      },
      {
        slug: "teslim",
        title: "Retuşlu dosyaları müşteriye teslim et",
        status: "Yayinlandi",
        priority: "Normal",
        assignee: "cansu",
        due: -6,
      },
    ],
  },
  {
    slug: "pellegro-kahve-rehberi",
    brandId: "pellegrocaffe",
    title: "Carousel: Espresso Rehberi",
    type: "Carousel",
    status: "Planlandi",
    assignee: "sila",
    target: 10,
    tasks: [
      {
        slug: "metin",
        title: "5 kare için metin akışı",
        status: "DevamEdiyor",
        priority: "Normal",
        assignee: "sila",
        due: 2,
      },
      {
        slug: "tasarim",
        title: "Kare tasarımları (marka renkleri)",
        status: "Beklemede",
        priority: "Normal",
        assignee: "ozgun",
        due: 6,
      },
    ],
  },
  {
    slug: "hbkuruyemis-bayram-kutu",
    brandId: "hbkuruyemis",
    title: "Bayram Kutu Tasarımı",
    type: "Foto",
    status: "IptalEdildi",
    assignee: "ozgun",
    target: -20,
    tasks: [
      {
        slug: "brief",
        title: "Kutu ölçüleri ve baskı brief'i",
        status: "Yayinlandi",
        priority: "Normal",
        assignee: "ozgun",
        due: -22,
        notes: "Müşteri bu sezon kutu basmaktan vazgeçti — iş iptal.",
      },
    ],
  },

  // ---- B2B / Yapı ----
  {
    slug: "ateknik-referans-vitrin",
    brandId: "ateknikyalitim",
    title: "B2B Referans Projeler Vitrini",
    type: "Carousel",
    status: "Uretimde",
    assignee: "yunus",
    target: 9,
    tasks: [
      {
        slug: "veri",
        title: "Son 12 ayın referans projelerini listele",
        status: "Onaylandi",
        priority: "Normal",
        assignee: "yunus",
        due: -5,
      },
      {
        slug: "foto",
        title: "Şantiye fotoğraflarını müşteriden iste",
        status: "DevamEdiyor",
        priority: "Yuksek",
        assignee: "erhan",
        due: -1,
        notes: "3 projeden foto geldi, 5 proje eksik.",
      },
      {
        slug: "tasarim",
        title: "Carousel tasarımı — proje kartı şablonu",
        status: "Beklemede",
        priority: "Normal",
        assignee: "ozgun",
        due: 5,
      },
      {
        slug: "linkedin",
        title: "LinkedIn uyarlaması (B2B kitle)",
        status: "Beklemede",
        priority: "Dusuk",
        assignee: null,
        due: 11,
      },
    ],
  },
  {
    slug: "ozanparke-oncesi-sonrasi",
    brandId: "ozanparke",
    title: "Öncesi/Sonrası Reels Serisi",
    type: "Reel",
    status: "Planlandi",
    assignee: "arman",
    target: 14,
    tasks: [
      {
        slug: "arsiv",
        title: "Arşivdeki uygulama videolarını tara",
        status: "DevamEdiyor",
        priority: "Normal",
        assignee: "arman",
        due: 1,
      },
      {
        slug: "format",
        title: "Split-screen şablonu hazırla",
        status: "Beklemede",
        priority: "Normal",
        assignee: "emrullah",
        due: 8,
      },
    ],
  },
  {
    slug: "antek-fuar-arsiv",
    brandId: "antek_makina",
    title: "Bahar Fuarı Paylaşımları (arşiv)",
    type: "Diger",
    status: "Tamamlandi",
    assignee: "erhan",
    target: -45,
    archived: true,
    tasks: [
      {
        slug: "ozet",
        title: "Fuar sonrası özet paylaşımı",
        status: "Yayinlandi",
        priority: "Dusuk",
        assignee: "erhan",
        due: -44,
      },
    ],
  },

  // ---- Hamam ----
  {
    slug: "alaaddin-tanitim-filmi",
    brandId: "alaaddinhammam",
    title: "Turist Odaklı Tanıtım Filmi",
    type: "Video",
    status: "Uretimde",
    assignee: "murat",
    target: 4,
    tasks: [
      {
        slug: "senaryo",
        title: "İngilizce alt yazılı senaryo",
        status: "Onaylandi",
        priority: "Normal",
        assignee: "sila",
        due: -7,
      },
      {
        slug: "cekim",
        title: "Hamam içi çekim (buhar/ışık testi dahil)",
        status: "Incelemede",
        priority: "Yuksek",
        assignee: "murat",
        due: -2,
      },
      {
        slug: "kurgu",
        title: "Kurgu ve renk",
        status: "DevamEdiyor",
        priority: "Yuksek",
        assignee: "arman",
        due: 2,
      },
      {
        slug: "ceviri",
        title: "EN/DE altyazı çevirisi",
        status: "Beklemede",
        priority: "Normal",
        assignee: "emrullah",
        due: 3,
      },
    ],
  },

  // ---- Gayrimenkul ----
  {
    slug: "prive-villa-lansman",
    brandId: "theprivefethiye",
    title: "Villa Lansman Kampanyası",
    type: "Kampanya",
    status: "Planlandi",
    assignee: "yunus",
    target: 21,
    tasks: [
      {
        slug: "hedef",
        title: "Hedef kitle ve bütçe planı",
        status: "DevamEdiyor",
        priority: "Yuksek",
        assignee: "yunus",
        due: 1,
      },
      {
        slug: "drone",
        title: "Drone çekimi izni ve randevu",
        status: "Beklemede",
        priority: "Acil",
        assignee: "murat",
        due: -1,
        notes: "İzin başvurusu gecikti — lansman tarihini riske atıyor.",
      },
      {
        slug: "landing",
        title: "Lansman açılış sayfası metni",
        status: "Beklemede",
        priority: "Normal",
        assignee: "sila",
        due: 9,
      },
    ],
  },

  // ---- Diğer ----
  {
    slug: "famedans-kayit-duyuru",
    brandId: "famedans",
    title: "Yeni Dönem Kayıt Duyurusu",
    type: "Kampanya",
    status: "Tamamlandi",
    assignee: "cansu",
    target: -3,
    tasks: [
      {
        slug: "afis",
        title: "Kayıt afişi tasarımı",
        status: "Yayinlandi",
        priority: "Normal",
        assignee: "ozgun",
        due: -10,
      },
      {
        slug: "reels",
        title: "Ders kayıtlarından tanıtım Reel'i",
        status: "Yayinlandi",
        priority: "Normal",
        assignee: "arman",
        due: -5,
      },
      {
        slug: "sonuc",
        title: "Kayıt sayısını raporla",
        status: "Incelemede",
        priority: "Dusuk",
        assignee: "yunus",
        due: 2,
      },
    ],
  },
];

// Görev yorumları: [içerik slug, görev slug, yazar id, gövde, kaç saat önce]
const COMMENTS: [string, string, string, string, number][] = [
  ["sihirliolta-agustos-reel", "kapak", "yunus", "Denetim raporundaki kapak testi notunu ekledim, tipografi en az 90pt olsun.", 30],
  ["sihirliolta-agustos-reel", "kapak", "defne", "Anladım, iki alternatif hazırlayıp buraya bırakacağım.", 26],
  ["sihirliolta-agustos-reel", "kurgu", "arman", "İlk kaba kurgu çıktı, ses seviyeleri düzeltilecek.", 8],
  ["hacibaba-soguk-kahve", "reels", "cansu", "Müşteri 2. Reel'de logo süresini uzatmamızı istedi.", 20],
  ["hacibaba-soguk-kahve", "reels", "arman", "Logoyu 1.5 sn'ye çıkardım, revize yükleniyor.", 5],
  ["prive-villa-lansman", "drone", "murat", "Belediyeden dönüş bekliyoruz, çarşambaya kadar cevap gelmezse plan B: yer çekimi.", 12],
  ["ateknik-referans-vitrin", "foto", "erhan", "Eksik 5 proje için müşteriye hatırlatma gönderildi.", 3],
  ["tersan-fuar-kimlik", "moodboard", "ozgun", "2. yönü teknik çizim dokusuyla revize ediyorum.", 40],
];

// Aktivite akışını da doldur — /activity sayfası boş görünmesin.
// [kişi id, action, entityType, içerik slug, özet, kaç saat önce]
const ACTIVITY: [string, string, "content" | "task", string, string, number][] = [
  ["yunus", "content.create", "content", "prive-villa-lansman", "\"Villa Lansman Kampanyası\" içeriğini oluşturdu", 72],
  ["cansu", "content.status", "content", "hacibaba-soguk-kahve", "\"Soğuk Kahve Kampanyası\" durumunu Üretimde yaptı", 48],
  ["defne", "task.status", "task", "cengiz-tezgah-foto", "\"Sabah tezgah çekimi\" görevini Onaylandı yaptı", 26],
  ["arman", "task.status", "task", "hacibaba-soguk-kahve", "\"3 adet Reel kurgusu\" görevini Devam Ediyor yaptı", 21],
  ["ozgun", "task.create", "task", "tersan-fuar-kimlik", "\"16 sayfalık katalog şablonu\" görevini ekledi", 18],
  ["murat", "comment.create", "task", "prive-villa-lansman", "\"Drone çekimi izni\" görevine yorum yaptı", 12],
  ["erhan", "task.assign", "task", "ateknik-referans-vitrin", "\"Şantiye fotoğraflarını iste\" görevini Erhan'a atadı", 6],
  ["arman", "comment.create", "task", "sihirliolta-agustos-reel", "\"1. bölüm kurgu\" görevine yorum yaptı", 4],
];

// ---- Fikir bankası ----
// [slug, kapsam, marka id (ofis fikrinde null), kategori, durum, başlık, gövde,
//  yazan, etiketler, kaynak platform, kaynak URL, kaç saat önce]
const IDEAS: {
  slug: string;
  scope: "office" | "brand";
  brandId: string | null;
  category: "Icerik" | "Kampanya" | "Gorsel" | "Strateji" | "Ofis" | "Diger";
  status: "Yeni" | "Gelistiriliyor" | "Hazir" | "Kullanildi";
  title: string;
  body: string;
  author: string;
  tags?: string;
  platform?: "Instagram" | "TikTok" | "Pinterest" | "YouTube" | "Web";
  url?: string;
  hoursAgo: number;
}[] = [
  { slug: "olta-dugum-serisi", scope: "brand", brandId: "sihirliolta", category: "Icerik", status: "Hazir", title: "Düğüm serisi — 6 bölümlük Reel", body: "Her bölüm tek bir düğüm: palomar, uni, fg. Ellerin üstten çekimi, üstte büyük punto düğüm adı. Bölüm sonunda bir sonrakinin adı görünsün.", author: "yunus", tags: "reel, seri, eğitim", platform: "Instagram", hoursAgo: 30 },
  { slug: "olta-musteri-avi", scope: "brand", brandId: "sihirliolta", category: "Kampanya", status: "Yeni", title: "Müşteri avı fotoğrafı yarışması", body: "Ay boyunca müşteriler kendi avlarını etiketlesin, ay sonunda en çok beğeni alan üç kişiye set hediye.", author: "cansu", tags: "ugc, yarışma", hoursAgo: 74 },
  { slug: "hacibaba-barista-portre", scope: "brand", brandId: "hacibabacoffee", category: "Gorsel", status: "Gelistiriliyor", title: "Barista portre serisi", body: "Her barista için tek kare siyah-beyaz portre + kendi imza içeceğinin renkli fotoğrafı. Grid'de şah-mat deseni oluşturur.", author: "defne", tags: "portre, grid", platform: "Pinterest", url: "https://tr.pinterest.com/", hoursAgo: 12 },
  { slug: "hacibaba-sabah-ritueli", scope: "brand", brandId: "hacibabacoffee", category: "Icerik", status: "Yeni", title: "Sabah ritüeli — 15 sn sessiz video", body: "Müzik yok, sadece ortam sesi: değirmen, buhar, fincan. Alt yazıyla tek cümle.", author: "arman", tags: "asmr, reel", hoursAgo: 50 },
  { slug: "prive-villa-gun-batimi", scope: "brand", brandId: "theprivefethiye", category: "Icerik", status: "Gelistiriliyor", title: "Havuz kenarı akşam çekimi", body: "Işıklar yanmadan hemen önce, havuz suyu arkadan aydınlatılmış. İnsan tam boy, kadraj kenarından kesilmeden.", author: "murat", tags: "villa, akşam", hoursAgo: 20 },
  { slug: "prive-son-villalar", scope: "brand", brandId: "theprivefethiye", category: "Kampanya", status: "Hazir", title: "Son 5 villa geri sayımı", body: "Haftada bir kalan villa sayısını gösteren tek kare + kısa Reel. Sayı düştükçe aciliyet artar.", author: "yunus", tags: "satış, reels", hoursAgo: 96 },
  { slug: "ateknik-santiye-oncesi-sonrasi", scope: "brand", brandId: "ateknikyalitim", category: "Icerik", status: "Yeni", title: "Şantiye öncesi/sonrası kaydırmalı", body: "Aynı açıdan iki fotoğraf, kaydırmalı karşılaştırma. Alt metinde uygulanan sistem ve süre.", author: "erhan", tags: "b2b, referans", hoursAgo: 8 },
  { slug: "ozanparke-doku-makro", scope: "brand", brandId: "ozanparke", category: "Gorsel", status: "Yeni", title: "Parke dokusu makro çekim", body: "Her ürün için tek makro kare: damar, yüzey mat/parlak farkı. Sabit ışık, sabit açı — seri olarak tutarlı.", author: "sila", tags: "ürün, makro", hoursAgo: 62 },
  { slug: "alaaddin-hamam-ritueli", scope: "brand", brandId: "alaaddinhammam", category: "Icerik", status: "Kullanildi", title: "Hamam ritüeli adım adım", body: "Sıcaklık, kese, köpük, dinlenme. Her adım tek kesme, buhar görünür kalsın.", author: "murat", tags: "tanıtım, ritüel", platform: "YouTube", hoursAgo: 220 },
  { slug: "justcafe-vitrin-lineup", scope: "brand", brandId: "justcafejust", category: "Gorsel", status: "Yeni", title: "Vitrin lineup — üç ürün tek kare", body: "Ürünleri tek tek değil, birlikte göster: aynı tepside üç içecek, arkada logo bulanık.", author: "defne", tags: "ürün, vitrin", hoursAgo: 5 },
  { slug: "tersan-fuar-stant-turu", scope: "brand", brandId: "tersanmarine", category: "Strateji", status: "Gelistiriliyor", title: "Fuar stant turu canlı yayın", body: "Fuarın ilk günü 10 dakikalık canlı stant turu; sonrasında öne çıkan üç anı Reel'e böl.", author: "ozgun", tags: "fuar, canlı", hoursAgo: 40 },
  { slug: "famedans-ogrenci-hikayesi", scope: "brand", brandId: "famedans", category: "Icerik", status: "Hazir", title: "Öğrenci hikâyesi — ilk ders / bugün", body: "Aynı öğrencinin ilk ders kaydı ve bugünkü performansı yan yana. Kayıt döneminde en güçlü kanıt.", author: "cansu", tags: "kayıt, dönüşüm", platform: "TikTok", hoursAgo: 16 },
  { slug: "ofis-cekim-ekipman-checklist", scope: "office", brandId: null, category: "Ofis", status: "Hazir", title: "Çekim öncesi ekipman kontrol listesi", body: "Her çekim çıkışında tek sayfalık liste: pil, kart, ND filtre, yedek yaka mikrofonu. Çıkışta ve dönüşte imzalanır.", author: "erhan", tags: "operasyon", hoursAgo: 130 },
  { slug: "ofis-aylik-ic-sunum", scope: "office", brandId: null, category: "Strateji", status: "Yeni", title: "Aylık iç sunum formatı", body: "Ay sonunda 20 dakikalık iç sunum: en iyi 3 iş, en zorlanılan 1 iş, gelecek ayın tek hedefi.", author: "berkant", tags: "ekip, ritim", hoursAgo: 180 },
  { slug: "ofis-arsiv-adlandirma", scope: "office", brandId: null, category: "Ofis", status: "Gelistiriliyor", title: "Arşiv klasör adlandırma standardı", body: "YYYY-AA-GG-marka-konu. Ham/kurgu/teslim alt klasörleri sabit. Yeni diske geçerken tek seferde uygulanır.", author: "ozgur", tags: "arşiv", hoursAgo: 300 },
];

// ---- Müşteri talepleri ----
const REQUESTS: {
  slug: string;
  brandId: string;
  title: string;
  description: string;
  requestedBy: string;
  department: string;
  contentType: ContentType;
  status: "Beklemede" | "Incelemede" | "Onaylandi" | "Reddedildi";
  priority: TaskPriority;
  assignee: string | null;
  due: number | null;
  createdBy: string;
  reviewedBy?: string;
  source?: string;
  hoursAgo: number;
}[] = [
  { slug: "sihirliolta-yeni-urun", brandId: "sihirliolta", title: "Yeni makine serisi için tanıtım Reel'i", description: "Eylülde gelen üç yeni makine için tek Reel. Ürünler kutusundan çıkmış halde, suyun kenarında çekilsin.", requestedBy: "Sihirli Olta – Kemal", department: "video", contentType: "Reel", status: "Beklemede", priority: "Yuksek", assignee: null, due: 9, createdBy: "yunus", source: "WhatsApp", hoursAgo: 6 },
  { slug: "hacibaba-yeni-sube", brandId: "hacibabacoffee", title: "Yeni şube açılış duyurusu", description: "Açılış tarihi netleşti; duyuru postu + açılış günü story serisi istiyorlar.", requestedBy: "Hacıbaba – Selin", department: "social", contentType: "Post", status: "Incelemede", priority: "Acil", assignee: "cansu", due: 3, createdBy: "cansu", reviewedBy: "berkant", source: "Toplantı", hoursAgo: 26 },
  { slug: "ateknik-katalog-guncelle", brandId: "ateknikyalitim", title: "Ürün kataloğu güncellemesi", description: "Kataloğun 12-18. sayfaları yeni sisteme göre değişecek. Teknik metinler müşteriden gelecek.", requestedBy: "A Teknik – Mehmet", department: "design", contentType: "KurumsalKimlik", status: "Onaylandi", priority: "Normal", assignee: "ozgun", due: 14, createdBy: "erhan", reviewedBy: "yunus", source: "E-posta", hoursAgo: 70 },
  { slug: "prive-tanitim-filmi", brandId: "theprivefethiye", title: "Proje tanıtım filmi (3 dk)", description: "Yatırımcı sunumunda gösterilecek 3 dakikalık film. Drone + iç mekân + röportaj.", requestedBy: "Privé – Deniz", department: "video", contentType: "Video", status: "Incelemede", priority: "Yuksek", assignee: "murat", due: 21, createdBy: "murat", reviewedBy: "yunus", source: "Toplantı", hoursAgo: 44 },
  { slug: "ozanparke-bayi-gorsel", brandId: "ozanparke", title: "Bayilere özel görsel paketi", description: "Bayiler kendi sosyal hesaplarında kullanacak; logosuz, boş alan bırakılmış 10 görsel.", requestedBy: "Ozan Parke – Arda", department: "design", contentType: "Foto", status: "Beklemede", priority: "Normal", assignee: null, due: 18, createdBy: "sila", source: "Telefon", hoursAgo: 15 },
  { slug: "famedans-kurs-afisi", brandId: "famedans", title: "Kış dönemi kurs afişi", description: "Basılı afiş + dijital versiyon. Ders saatleri tabloya girecek.", requestedBy: "Fame – Ece", department: "design", contentType: "Post", status: "Onaylandi", priority: "Normal", assignee: "sila", due: 7, createdBy: "cansu", reviewedBy: "berkant", source: "WhatsApp", hoursAgo: 90 },
  { slug: "adadis-fuar-sunum", brandId: "adadisticaret", title: "İhracat fuarı sunum şablonu", description: "İngilizce, 15 slaytlık kurumsal sunum. Marka kimliği yeni kılavuza göre.", requestedBy: "ADA – Burak", department: "design", contentType: "KurumsalKimlik", status: "Beklemede", priority: "Dusuk", assignee: null, due: 30, createdBy: "ozgur", source: "E-posta", hoursAgo: 120 },
  { slug: "buyukhammam-menu-cevirisi", brandId: "buyukhammam", title: "Hizmet menüsünün İngilizce çevirisi", description: "Mevcut menü görselleri kalacak, yalnızca metinler İngilizceye çevrilecek.", requestedBy: "Nicosia – Hakan", department: "social", contentType: "Diger", status: "Reddedildi", priority: "Dusuk", assignee: null, due: null, createdBy: "cansu", reviewedBy: "berkant", source: "WhatsApp", hoursAgo: 200 },
  { slug: "arkay-tekne-bakim", brandId: "arkaymarine", title: "Bakım sezonu hatırlatma serisi", description: "Kış bakımı için 4 haftalık hatırlatma serisi; her hafta tek konu.", requestedBy: "Arkay – Serkan", department: "social", contentType: "Story", status: "Beklemede", priority: "Normal", assignee: null, due: 25, createdBy: "yunus", source: "Toplantı", hoursAgo: 34 },
  { slug: "travellab-tur-takvimi", brandId: "travellabbalikturu", title: "Sezon tur takvimi görseli", description: "Tüm tur tarihleri tek karede, telefonda okunabilir punto ile.", requestedBy: "Travellab – Onur", department: "design", contentType: "Carousel", status: "Beklemede", priority: "Yuksek", assignee: null, due: 5, createdBy: "defne", source: "WhatsApp", hoursAgo: 10 },
];

// ---- Takvim: toplantılar ve çekimler ----
const EVENTS: {
  slug: string;
  brandId: string | null;
  type: "Toplanti" | "Cekim" | "Diger";
  title: string;
  description?: string;
  day: number;
  startHour?: number;
  durationHours?: number;
  allDay?: boolean;
  location?: string;
  guestVisible?: boolean;
}[] = [
  { slug: "hacibaba-aylik-toplanti", brandId: "hacibabacoffee", type: "Toplanti", title: "Hacıbaba aylık değerlendirme", description: "Geçen ayın performansı + eylül planı.", day: -6, startHour: 10, durationHours: 1, location: "Ofis · Toplantı odası" },
  { slug: "sihirliolta-cekim", brandId: "sihirliolta", type: "Cekim", title: "Sihirli Olta göl çekimi", description: "Gün doğumu; iki makine + üç olta seti.", day: -3, startHour: 6, durationHours: 5, location: "Eğirdir Gölü", guestVisible: true },
  { slug: "prive-drone", brandId: "theprivefethiye", type: "Cekim", title: "Privé drone çekimi", description: "İzin bekleniyor; plan B yer çekimi.", day: 2, startHour: 16, durationHours: 3, location: "Fethiye · Şantiye", guestVisible: true },
  { slug: "ateknik-santiye", brandId: "ateknikyalitim", type: "Cekim", title: "A Teknik şantiye fotoğrafları", day: 4, startHour: 9, durationHours: 4, location: "Ankara · OSB" },
  { slug: "prive-musteri-toplanti", brandId: "theprivefethiye", type: "Toplanti", title: "Privé tanıtım filmi brief", description: "Film senaryosu ve çekim takvimi.", day: 1, startHour: 14, durationHours: 2, location: "Zoom" },
  { slug: "alaaddin-kurgu-izleme", brandId: "alaaddinhammam", type: "Toplanti", title: "Tanıtım filmi ilk kurgu izleme", day: 3, startHour: 11, durationHours: 1, location: "Ofis · Kurgu" },
  { slug: "tersan-fuar", brandId: "tersanmarine", type: "Diger", title: "Tersan fuar günü", description: "Stant kurulumu ve canlı yayın.", day: 9, allDay: true, location: "İstanbul Fuar Merkezi" },
  { slug: "famedans-kayit-cekim", brandId: "famedans", type: "Cekim", title: "Fame Dans kayıt dönemi çekimi", day: 6, startHour: 18, durationHours: 3, location: "Stüdyo" },
  { slug: "ofis-haftalik", brandId: null, type: "Toplanti", title: "Haftalık ekip toplantısı", description: "Açık işler, tıkanan işler, haftanın önceliği.", day: 0, startHour: 9, durationHours: 1, location: "Ofis" },
  { slug: "ozanparke-urun-cekim", brandId: "ozanparke", type: "Cekim", title: "Ozan Parke ürün çekimi", day: 12, startHour: 13, durationHours: 4, location: "Ofis · Stüdyo" },
  { slug: "cengiz-tezgah-cekim", brandId: "cengizbalikcilik", type: "Cekim", title: "Cengiz Balıkçılık sabah tezgahı", day: -8, startHour: 7, durationHours: 2, location: "Balık hali" },
  { slug: "kahvecihb-menu", brandId: "kahvecihb", type: "Toplanti", title: "Menü yenileme değerlendirmesi", day: -14, startHour: 15, durationHours: 1, location: "Şube" },
];

// ---- Teslimler ----
// CHECK kısıtlaması sıkı: "Beklemede" hiçbir karar alanı taşıyamaz, "Onaylandi"
// revizyon nedeni taşıyamaz, "RevizeIstendi" ise not + neden ZORUNLU.
const DELIVERIES: {
  content: string;
  task: string;
  version: number;
  note: string;
  url?: string;
  by: string;
  submittedHoursAgo: number;
  decision?: {
    status: "Onaylandi" | "RevizeIstendi";
    actorKind: "team" | "guest";
    byName: string;
    note?: string;
    reason?: "BriefDegisikligi" | "MusteriDegisikligi" | "Tasarim" | "Metin" | "Teknik" | "Diger";
    hoursAgo: number;
  };
}[] = [
  { content: "alaaddin-tanitim-filmi", task: "cekim", version: 1, note: "Ham çekimden ilk seçki — 42 klip.", by: "Murat", submittedHoursAgo: 52, decision: { status: "RevizeIstendi", actorKind: "team", byName: "Yunus Emre", note: "Buhar sahneleri az; kese bölümünden iki kare daha lazım.", reason: "Tasarim", hoursAgo: 44 } },
  { content: "alaaddin-tanitim-filmi", task: "cekim", version: 2, note: "Eksik sahneler eklendi, renk düzeltmesi yapıldı.", by: "Murat", submittedHoursAgo: 20 },
  { content: "tersan-fuar-kimlik", task: "moodboard", version: 1, note: "İki yön: teknik çizim dokusu ve fotoğraf ağırlıklı.", by: "Özgün", submittedHoursAgo: 60, decision: { status: "RevizeIstendi", actorKind: "guest", byName: "Tersan Marine", note: "İkinci yön daha yakın ama tipografi çok ince kalmış.", reason: "MusteriDegisikligi", hoursAgo: 50 } },
  { content: "tersan-fuar-kimlik", task: "moodboard", version: 2, note: "Tipografi kalınlaştırıldı, ikinci yön geliştirildi.", by: "Özgün", submittedHoursAgo: 14 },
  { content: "hacibaba-soguk-kahve", task: "urun-cekim", version: 1, note: "12 ürün karesi, iki ışık kurulumu.", by: "Defne", submittedHoursAgo: 100, decision: { status: "Onaylandi", actorKind: "guest", byName: "Hacıbaba Coffee", hoursAgo: 92 } },
  { content: "cengiz-tezgah-foto", task: "cekim", version: 1, note: "Sabah tezgahı — 30 kare.", by: "Defne", submittedHoursAgo: 76, decision: { status: "Onaylandi", actorKind: "team", byName: "Yunus Emre", hoursAgo: 70 } },
  { content: "famedans-kayit-duyuru", task: "sonuc", version: 1, note: "İlk hafta kayıt sayıları ve erişim raporu.", by: "Yunus Emre", submittedHoursAgo: 9 },
  { content: "ateknik-referans-vitrin", task: "veri", version: 1, note: "38 referans projenin tablosu.", by: "Yunus Emre", submittedHoursAgo: 130, decision: { status: "Onaylandi", actorKind: "team", byName: "Erhan", hoursAgo: 124 } },
];

// ---- Revize turları ----
const REVISIONS: {
  content: string;
  task: string;
  round: number;
  targetMinutes: number;
  note: string;
  startedHoursAgo: number;
  completedHoursAgo?: number;
  by: string;
  completedBy?: string;
}[] = [
  { content: "alaaddin-tanitim-filmi", task: "cekim", round: 1, targetMinutes: 480, note: "Eksik buhar sahneleri.", startedHoursAgo: 44, completedHoursAgo: 21, by: "yunus", completedBy: "murat" },
  { content: "tersan-fuar-kimlik", task: "moodboard", round: 1, targetMinutes: 240, note: "Tipografi revizyonu.", startedHoursAgo: 50, completedHoursAgo: 15, by: "ozgun", completedBy: "ozgun" },
  { content: "tersan-fuar-kimlik", task: "moodboard", round: 2, targetMinutes: 120, note: "Müşteri ikinci turda renk istedi — süre hedefi aşıldı.", startedHoursAgo: 12, by: "berkant" },
  { content: "hacibaba-soguk-kahve", task: "reels", round: 1, targetMinutes: 180, note: "Logo süresi 1.5 sn'ye çıkarılacak.", startedHoursAgo: 6, by: "cansu" },
];

// ---- Marka sorumluları ----
// Bu tablonun id'si yok (PK: person_id + brand_id), yani `demo-%` deseniyle
// ayırt edilemiyor. Bu yüzden yazım ZATEN SORUMLUSU OLAN markayı atlar ve
// `--clean` yalnızca aşağıdaki tam çiftleri siler — elle yapılmış bir atama
// demo verisiyle ezilmez.
const ASSIGNMENTS: [person: string, brand: string][] = [
  ["yunus", "sihirliolta"], ["defne", "sihirliolta"],
  ["murat", "ns.blackhole"],
  ["defne", "cengizbalikcilik"],
  ["ozgun", "tersanmarine"],
  ["cansu", "hacibabacoffee"], ["arman", "hacibabacoffee"],
  ["defne", "kahvecihb"],
  ["sila", "pellegrocaffe"],
  ["ozgun", "hbkuruyemis"],
  ["erhan", "ateknikyalitim"], ["yunus", "ateknikyalitim"],
  ["arman", "ozanparke"],
  ["erhan", "antek_makina"],
  ["murat", "alaaddinhammam"],
  ["yunus", "theprivefethiye"], ["murat", "theprivefethiye"],
  ["cansu", "famedans"],
  ["defne", "justcafejust"],
  ["ozgur", "adadisticaret"],
  ["cansu", "buyukhammam"],
  ["yunus", "arkaymarine"],
  ["sila", "travellabbalikturu"],
];

// ---- Kişisel hedef tarihleri (Panom'daki "hedef teslim" sütunu) ----
const PERSONAL_TARGETS: [content: string, task: string, person: string, day: number][] = [
  ["hacibaba-soguk-kahve", "reels", "arman", 1],
  ["alaaddin-tanitim-filmi", "kurgu", "arman", 1],
  ["ateknik-referans-vitrin", "foto", "erhan", 0],
  ["cengiz-tezgah-foto", "retus", "cansu", 2],
  ["pellegro-kahve-rehberi", "metin", "sila", 3],
  ["ozanparke-oncesi-sonrasi", "arsiv", "arman", 2],
];

// ---- Bildirimler ----
const NOTIFICATIONS: {
  slug: string;
  recipient: string;
  actor: string;
  content: string;
  task: string;
  summary: string;
  read: boolean;
  hoursAgo: number;
}[] = [
  { slug: "n1", recipient: "arman", actor: "cansu", content: "hacibaba-soguk-kahve", task: "reels", summary: "Cansu \"3 adet Reel kurgusu\" görevine yorum yaptı", read: false, hoursAgo: 5 },
  { slug: "n2", recipient: "murat", actor: "yunus", content: "alaaddin-tanitim-filmi", task: "cekim", summary: "Yunus Emre teslimi revizeye gönderdi", read: false, hoursAgo: 44 },
  { slug: "n3", recipient: "ozgun", actor: "berkant", content: "tersan-fuar-kimlik", task: "moodboard", summary: "Berkant yeni bir revize turu açtı", read: false, hoursAgo: 12 },
  { slug: "n4", recipient: "erhan", actor: "yunus", content: "ateknik-referans-vitrin", task: "foto", summary: "Yunus Emre görevi sana atadı", read: true, hoursAgo: 30 },
  { slug: "n5", recipient: "sila", actor: "defne", content: "pellegro-kahve-rehberi", task: "metin", summary: "Defne \"Rehber metni\" görevini güncelledi", read: false, hoursAgo: 18 },
  { slug: "n6", recipient: "cansu", actor: "defne", content: "cengiz-tezgah-foto", task: "retus", summary: "Defne çekim teslimini onayladı", read: true, hoursAgo: 68 },
];

const db = getDb();

// ---- Temizlik (idempotent yeniden çalıştırma) ----
// Sıra önemli değil (CASCADE var) ama activity_log'un FK'si yok, elle silinmeli.
const deletedActivity = db
  .prepare("DELETE FROM activity_log WHERE id LIKE 'demo-%'")
  .run().changes;
const deletedContent = db
  .prepare("DELETE FROM content_items WHERE id LIKE 'demo-%'")
  .run().changes;
// Teslim / revize turu / kişisel hedef ayrıca silinmiyor: hepsi tasks'a
// ON DELETE CASCADE ile bağlı, içerik silinince görevlerle birlikte düşüyorlar.
const deletedIdeas = db.prepare("DELETE FROM ideas WHERE id LIKE 'demo-%'").run().changes;
const deletedRequests = db.prepare("DELETE FROM client_requests WHERE id LIKE 'demo-%'").run().changes;
const deletedEvents = db.prepare("DELETE FROM calendar_events WHERE id LIKE 'demo-%'").run().changes;
const deletedNotifications = db.prepare("DELETE FROM notifications WHERE id LIKE 'demo-%'").run().changes;
// person_brand_assignments'ın id'si yok; yalnızca bu script'in yazdığı TAM
// çiftler siliniyor (yukarıdaki ASSIGNMENTS notuna bak).
const deleteAssignment = db.prepare(
  "DELETE FROM person_brand_assignments WHERE person_id = ? AND brand_id = ?",
);
let deletedAssignments = 0;
for (const [person, brand] of ASSIGNMENTS) {
  deletedAssignments += Number(deleteAssignment.run(person, brand).changes);
}

console.log(
  `Temizlendi: ${deletedContent} içerik (+ bağlı görev/yorum/teslim/revize), ${deletedActivity} aktivite, ` +
  `${deletedIdeas} fikir, ${deletedRequests} talep, ${deletedEvents} etkinlik, ${deletedNotifications} bildirim, ` +
  `${deletedAssignments} marka sorumlusu.`,
);

if (CLEAN_ONLY) {
  console.log("--clean verildi, yeni kayıt yazılmadı.");
  process.exit(0);
}

// ---- Yazma ----
const brandExists = db.prepare("SELECT 1 FROM brands WHERE id = ?");
const insertContent = db.prepare(
  `INSERT INTO content_items (id, brand_id, title, type, target_date, status, assignee_id, archived)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insertTask = db.prepare(
  `INSERT INTO tasks (id, content_item_id, title, status, priority, difficulty, weight_points, assignee_id, due_date, notes)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insertIdea = db.prepare(
  `INSERT INTO ideas (id, scope_type, brand_id, brand_name_snapshot, category, status, title, body,
                      source_url, source_platform, tags_text, created_by_id, created_by_name, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insertRequest = db.prepare(
  `INSERT INTO client_requests (id, brand_id, title, description, requested_by_name, source, department,
                                content_type, status, priority, assignee_id, due_date, created_by_id,
                                reviewed_by_id, reviewed_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insertEvent = db.prepare(
  `INSERT INTO calendar_events (id, brand_id, type, color_key, title, description, start_at, end_at,
                                all_day, location, guest_visible, sync_status)
   VALUES (?, ?, ?, 'auto', ?, ?, ?, ?, ?, ?, ?, 'pending')`,
);
const insertDelivery = db.prepare(
  `INSERT INTO task_deliveries (id, task_id, version_number, note, external_url, guest_visible, status,
                                submitted_by_name, submitted_at, decision_actor_kind, decided_by_name,
                                decision_note, revision_reason, decided_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insertRevision = db.prepare(
  `INSERT INTO task_revision_rounds (id, task_id, round_number, target_minutes, note, started_at,
                                     completed_at, created_by, completed_by)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insertAssignment = db.prepare(
  "INSERT OR IGNORE INTO person_brand_assignments (person_id, brand_id, assigned_by) VALUES (?, ?, ?)",
);
const brandHasAssignment = db.prepare(
  "SELECT 1 FROM person_brand_assignments WHERE brand_id = ?",
);
const insertPersonalTarget = db.prepare(
  "INSERT OR REPLACE INTO task_personal_targets (task_id, person_id, target_date) VALUES (?, ?, ?)",
);
const insertNotification = db.prepare(
  `INSERT INTO notifications (id, recipient_id, recipient_name, actor_id, actor_name, task_id, brand_id, summary, read, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insertComment = db.prepare(
  "INSERT INTO comments (id, task_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)",
);
const insertActivity = db.prepare(
  `INSERT INTO activity_log (id, actor_id, actor_name, action, entity_type, entity_id, brand_id, summary, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const personName = db.prepare("SELECT name FROM people WHERE id = ?");
const brandNameOf = db.prepare("SELECT name FROM brands WHERE id = ?");

let contentCount = 0;
let taskCount = 0;
let ideaCount = 0;
let requestCount = 0;
let eventCount = 0;
let deliveryCount = 0;
let revisionCount = 0;
let assignmentCount = 0;
let targetCount = 0;
let notificationCount = 0;
// Aynı markaya birden fazla sorumlu yazarken "zaten sorumlusu var" kontrolüne
// kendi yazdıklarımız takılmasın.
const seededBrands = new Set<string>();

db.exec("BEGIN");
try {
  for (const c of CONTENT) {
    if (!brandExists.get(c.brandId)) {
      console.warn(`! Marka yok, atlandı: ${c.brandId}`);
      continue;
    }
    const contentId = `demo-${c.slug}`;
    insertContent.run(
      contentId,
      c.brandId,
      c.title,
      c.type,
      c.target === null ? null : day(c.target),
      c.status,
      c.assignee,
      c.archived ? 1 : 0,
    );
    contentCount++;

    for (const t of c.tasks) {
      const difficulty = difficultyFor(taskCount);
      insertTask.run(
        `demo-${c.slug}-${t.slug}`,
        contentId,
        t.title,
        t.status,
        t.priority,
        difficulty,
        weightFor(taskCount, difficulty),
        t.assignee,
        t.due === null ? null : day(t.due),
        t.notes ?? null,
      );
      taskCount++;
    }
  }

  let i = 0;
  for (const [contentSlug, taskSlug, author, body, hoursAgo] of COMMENTS) {
    insertComment.run(
      `demo-comment-${i++}`,
      `demo-${contentSlug}-${taskSlug}`,
      author,
      body,
      ts(hoursAgo),
    );
  }

  let j = 0;
  for (const [actor, action, entityType, contentSlug, summary, hoursAgo] of ACTIVITY) {
    const brandId = CONTENT.find((c) => c.slug === contentSlug)?.brandId ?? null;
    const actorRow = personName.get(actor) as { name: string } | undefined;
    insertActivity.run(
      `demo-activity-${j++}`,
      actor,
      actorRow?.name ?? actor,
      action,
      entityType,
      `demo-${contentSlug}`,
      brandId,
      summary,
      ts(hoursAgo),
    );
  }

  for (const idea of IDEAS) {
    const brandName = idea.brandId
      ? (brandNameOf.get(idea.brandId) as { name: string } | undefined)?.name ?? null
      : null;
    if (idea.brandId && brandName === null) continue;
    const authorRow = personName.get(idea.author) as { name: string } | undefined;
    insertIdea.run(
      `demo-idea-${idea.slug}`,
      idea.scope,
      idea.brandId,
      brandName,
      idea.category,
      idea.status,
      idea.title,
      idea.body,
      idea.url ?? null,
      idea.platform ?? null,
      idea.tags ?? null,
      idea.author,
      authorRow?.name ?? idea.author,
      ts(idea.hoursAgo),
      ts(idea.hoursAgo),
    );
    ideaCount++;
  }

  for (const request of REQUESTS) {
    if (!brandExists.get(request.brandId)) continue;
    insertRequest.run(
      `demo-request-${request.slug}`,
      request.brandId,
      request.title,
      request.description,
      request.requestedBy,
      request.source ?? null,
      request.department,
      request.contentType,
      request.status,
      request.priority,
      request.assignee,
      request.due === null ? null : day(request.due),
      request.createdBy,
      request.reviewedBy ?? null,
      request.reviewedBy ? ts(Math.max(0, request.hoursAgo - 4)) : null,
      ts(request.hoursAgo),
      ts(request.hoursAgo),
    );
    requestCount++;
  }

  for (const event of EVENTS) {
    if (event.brandId && !brandExists.get(event.brandId)) continue;
    const allDay = event.allDay === true;
    insertEvent.run(
      `demo-event-${event.slug}`,
      event.brandId,
      event.type,
      event.title,
      event.description ?? null,
      allDay ? day(event.day) : isoAt(event.day, event.startHour ?? 10),
      allDay ? day(event.day + 1) : isoAt(event.day, (event.startHour ?? 10) + (event.durationHours ?? 1)),
      allDay ? 1 : 0,
      event.location ?? null,
      event.guestVisible ? 1 : 0,
    );
    eventCount++;
  }

  for (const delivery of DELIVERIES) {
    const decision = delivery.decision;
    insertDelivery.run(
      `demo-delivery-${delivery.content}-${delivery.task}-${delivery.version}`,
      `demo-${delivery.content}-${delivery.task}`,
      delivery.version,
      delivery.note,
      delivery.url ?? null,
      0,
      decision ? decision.status : "Beklemede",
      delivery.by,
      ts(delivery.submittedHoursAgo),
      decision ? decision.actorKind : null,
      decision ? decision.byName : null,
      decision?.note ?? null,
      decision?.reason ?? null,
      decision ? ts(decision.hoursAgo) : null,
    );
    deliveryCount++;
  }

  for (const revision of REVISIONS) {
    insertRevision.run(
      `demo-revision-${revision.content}-${revision.task}-${revision.round}`,
      `demo-${revision.content}-${revision.task}`,
      revision.round,
      revision.targetMinutes,
      revision.note,
      ts(revision.startedHoursAgo),
      revision.completedHoursAgo === undefined ? null : ts(revision.completedHoursAgo),
      revision.by,
      revision.completedBy ?? null,
    );
    revisionCount++;
  }

  for (const [person, brand] of ASSIGNMENTS) {
    if (!brandExists.get(brand)) continue;
    // Elle atanmış bir sorumluyu ezme: markanın hiç sorumlusu yoksa yaz.
    if (brandHasAssignment.get(brand) && !seededBrands.has(brand)) continue;
    seededBrands.add(brand);
    insertAssignment.run(person, brand, person);
    assignmentCount++;
  }

  for (const [content, task, person, offset] of PERSONAL_TARGETS) {
    insertPersonalTarget.run(`demo-${content}-${task}`, person, day(offset));
    targetCount++;
  }

  for (const notification of NOTIFICATIONS) {
    const recipientRow = personName.get(notification.recipient) as { name: string } | undefined;
    const actorRow = personName.get(notification.actor) as { name: string } | undefined;
    insertNotification.run(
      `demo-notification-${notification.slug}`,
      notification.recipient,
      recipientRow?.name ?? notification.recipient,
      notification.actor,
      actorRow?.name ?? notification.actor,
      `demo-${notification.content}-${notification.task}`,
      CONTENT.find((c) => c.slug === notification.content)?.brandId ?? null,
      notification.summary,
      notification.read ? 1 : 0,
      ts(notification.hoursAgo),
    );
    notificationCount++;
  }

  db.exec("COMMIT");
} catch (err) {
  db.exec("ROLLBACK");
  throw err;
}

console.log(
  `Eklendi: ${contentCount} içerik, ${taskCount} görev, ${COMMENTS.length} yorum, ${ACTIVITY.length} aktivite,\n` +
  `         ${ideaCount} fikir, ${requestCount} talep, ${eventCount} takvim etkinliği, ${deliveryCount} teslim,\n` +
  `         ${revisionCount} revize turu, ${assignmentCount} marka sorumlusu, ${targetCount} kişisel hedef, ${notificationCount} bildirim.`,
);
console.log("Geri almak için: npm run db:seed:demo -- --clean");
