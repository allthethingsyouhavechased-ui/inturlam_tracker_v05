import fs from "node:fs/promises";
import path from "node:path";
import { hashPassword } from "../lib/auth/password.ts";
import { getDb } from "../lib/db/client.ts";

// v03 inceleme ortamını tamamen kurgusal ve yeniden üretilebilir veriye çevirir.
// Bu komut yalnızca çalışma dizinindeki data/inturlam.db ve data/uploads hedeflerini
// kullanır. Çalıştırmadan önce npm run db:backup ile geri dönüş noktası alınmalıdır.

type SqlValue = string | number | null;
type DemoRow = Record<string, SqlValue>;

const repoRoot = path.resolve(process.cwd());
const expectedRepoName = "inturlam-tracker-v03";
if (path.basename(repoRoot).toLowerCase() !== expectedRepoName) {
  throw new Error(`Güvenlik kontrolü: bu komut yalnızca ${expectedRepoName} kökünde çalışır.`);
}

const uploadRoot = path.resolve(repoRoot, "data", "uploads");
const expectedUploadRoot = path.resolve(repoRoot, "data", "uploads");
if (uploadRoot !== expectedUploadRoot || !uploadRoot.startsWith(`${repoRoot}${path.sep}`)) {
  throw new Error("Güvenlik kontrolü: upload hedefi v03 çalışma alanının dışında.");
}

const db = getDb();
const TEAM_PASSWORD = "Demo2026!";
const GUEST_PASSWORD = "Guest2026!";
const teamPasswordHash = hashPassword(TEAM_PASSWORD);
const guestPasswordHash = hashPassword(GUEST_PASSWORD);

function insert(table: string, row: DemoRow): void {
  if (!/^[a-z_]+$/.test(table)) throw new Error(`Geçersiz tablo adı: ${table}`);
  const columns = Object.keys(row);
  const placeholders = columns.map(() => "?").join(", ");
  db.prepare(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
  ).run(...Object.values(row));
}

function dateFromToday(offset: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function timestampFromNow(dayOffset: number, hour = 10, minute = 0): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function monthKey(offset = 0): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + offset);
  return date.toISOString().slice(0, 7);
}

function monthDate(day: number, offset = 0): string {
  return `${monthKey(offset)}-${String(day).padStart(2, "0")}`;
}

function addTask(row: DemoRow): void {
  insert("tasks", {
    priority: "Normal",
    difficulty: "Orta",
    notes: null,
    weight_points: 1,
    origin: "team",
    requested_date: null,
    guest_brief: null,
    created_by_account_id: "demo-account-admin",
    repeat_days: null,
    completed_at: null,
    completed_by: null,
    archived_at: null,
    created_at: timestampFromNow(-12),
    updated_at: timestampFromNow(-1),
    ...row,
  });
}

const allTables = db
  .prepare(
    `SELECT name FROM sqlite_schema
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name`,
  )
  .all() as Array<{ name: string }>;

db.exec("PRAGMA foreign_keys = OFF; BEGIN IMMEDIATE;");
try {
  for (const { name } of allTables) {
    if (!/^[a-z_]+$/.test(name)) throw new Error(`Beklenmeyen tablo adı: ${name}`);
    db.exec(`DELETE FROM ${name}`);
  }

  const clusters: DemoRow[] = [
    { id: "demo-food", label: "Demo · Yeme & İçme", sort_order: 10 },
    { id: "demo-marine", label: "Demo · Deniz & Turizm", sort_order: 20 },
    { id: "demo-construction", label: "Demo · Yapı & B2B", sort_order: 30 },
    { id: "demo-lifestyle", label: "Demo · Yaşam & Hizmet", sort_order: 40 },
  ];
  clusters.forEach((row) => insert("clusters", row));

  const brands: DemoRow[] = [
    {
      id: "demo-aurora", name: "Aurora Coffee Lab", cluster: "demo-food", sort_order: 10,
      archived: 0, logo_path: "/uploads/logos/demo-aurora.png", instagram_handle: "demo.aurora.coffee",
      follower_count: 18420, post_count: 642, median_reel_views: "12.800",
      cover_test_verdict: "Gecti", cover_test_note: "Demo kapak sistemi tutarlı.",
      key_finding: "Ürün videoları güçlü; ekip hikâyeleri az.", first_action: "Barista serisini haftalık formata dönüştür.",
      tier: "A", stats_updated_at: dateFromToday(-2), monthly_shoot_allowance: 2, annual_shoot_allowance: 20,
    },
    {
      id: "demo-mavirota", name: "Mavi Rota Denizcilik", cluster: "demo-marine", sort_order: 20,
      archived: 0, logo_path: null, instagram_handle: "demo.mavirota",
      follower_count: 9350, post_count: 318, median_reel_views: "7.450",
      cover_test_verdict: "Kismen", cover_test_note: "Tekne modelleri kapakta ayırt edilemiyor.",
      key_finding: "Teknik sorular yüksek niyet taşıyor ama yanıt süresi uzun.", first_action: "Model bazlı SSS serisi aç.",
      tier: "B", stats_updated_at: dateFromToday(-7), monthly_shoot_allowance: 1, annual_shoot_allowance: 10,
    },
    {
      id: "demo-novayapi", name: "Nova Yapı Sistemleri", cluster: "demo-construction", sort_order: 30,
      archived: 0, logo_path: null, instagram_handle: "demo.novayapi",
      follower_count: 4220, post_count: 205, median_reel_views: "3.100",
      cover_test_verdict: "Basarisiz", cover_test_note: "Jenerik stok görseller ağırlıkta.",
      key_finding: "Saha uzmanlığı içeriklere yansımıyor.", first_action: "Uygulama öncesi/sonrası kanıt serisi üret.",
      tier: "B", stats_updated_at: dateFromToday(-14), monthly_shoot_allowance: 2, annual_shoot_allowance: 18,
    },
    {
      id: "demo-luna", name: "Luna Wellness Studio", cluster: "demo-lifestyle", sort_order: 40,
      archived: 0, logo_path: null, instagram_handle: "demo.luna.wellness",
      follower_count: 12700, post_count: 487, median_reel_views: "9.900",
      cover_test_verdict: "Gecti", cover_test_note: null,
      key_finding: "Eğitmen yüzlü içerikler en yüksek kaydı getiriyor.", first_action: "Uzman soru-cevap serisini ölçekle.",
      tier: "A", stats_updated_at: dateFromToday(-1), monthly_shoot_allowance: 3, annual_shoot_allowance: 24,
    },
    {
      id: "demo-kentbahce", name: "Kent Bahçe", cluster: "demo-lifestyle", sort_order: 50,
      archived: 0, logo_path: null, instagram_handle: "demo.kentbahce",
      follower_count: 850, post_count: 44, median_reel_views: "620",
      cover_test_verdict: "Sinirda", cover_test_note: "Yeni marka; veri sınırlı.",
      key_finding: "Henüz düzenli içerik ritmi yok.", first_action: "İlk 30 günlük içerik planını oluştur.",
      tier: "C", stats_updated_at: dateFromToday(-30), monthly_shoot_allowance: null, annual_shoot_allowance: null,
    },
    {
      id: "demo-arsivmarka", name: "Arşiv Demo Markası", cluster: "demo-food", sort_order: 90,
      archived: 1, logo_path: null, instagram_handle: null,
      follower_count: 2100, post_count: 96, median_reel_views: "1.250",
      cover_test_verdict: "Kismen", cover_test_note: "Sözleşmesi sona ermiş test markası.",
      key_finding: "Arşiv görünümünü doğrulamak için tutulur.", first_action: "Yok.",
      tier: "C", stats_updated_at: dateFromToday(-90), monthly_shoot_allowance: 1, annual_shoot_allowance: 8,
    },
  ];
  brands.forEach((row) => insert("brands", row));

  const people: DemoRow[] = [
    { id: "demo-admin", name: "Demo Yönetici", title: "Operasyon Yöneticisi", bio: "Tüm yönetici akışlarını incelemek için kurgusal hesap.", avatar_path: null, department: "management", password_hash: teamPasswordHash, is_manager: 1, active: 1 },
    { id: "demo-ayse", name: "Ayşe Test", title: "Sosyal Medya Uzmanı", bio: "Sosyal planlama ve marka ilerleme senaryoları.", avatar_path: null, department: "social", password_hash: teamPasswordHash, is_manager: 0, active: 1 },
    { id: "demo-burak", name: "Burak Test", title: "Video Editörü", bio: "Kurgu, teslim ve revize örneklerinin sahibi.", avatar_path: null, department: "video", password_hash: teamPasswordHash, is_manager: 0, active: 1 },
    { id: "demo-deniz", name: "Deniz Test", title: "Tasarımcı", bio: "Tasarım görevleri ve fikir bankası örnekleri.", avatar_path: null, department: "design", password_hash: teamPasswordHash, is_manager: 0, active: 1 },
    { id: "demo-emre", name: "Emre Test", title: "Video Prodüktörü", bio: "Çekim ve takvim akışları.", avatar_path: null, department: "video", password_hash: teamPasswordHash, is_manager: 1, active: 1 },
    // Talepler modülü ürün kararı gereği sabit hesap kimlikleriyle korunuyor.
    // Görünen ad/veri tamamen kurgusal; bu teknik anahtar sayfayı incelemeye açar.
    { id: "cansu", name: "Talep İnceleme Demo", title: "Müşteri Talepleri Uzmanı", bio: "Talepler liste ve karar ekranlarını incelemek için kurgusal hesap.", avatar_path: null, department: "social", password_hash: teamPasswordHash, is_manager: 0, active: 1 },
    { id: "demo-pasif", name: "Pasif Demo Kullanıcı", title: "Eski ekip üyesi", bio: "Pasif hesap görünümünü test eder.", avatar_path: null, department: "design", password_hash: teamPasswordHash, is_manager: 0, active: 0 },
  ];
  people.forEach((row) => insert("people", row));

  for (const person of people) {
    insert("accounts", {
      id: `demo-account-${String(person.id).replace("demo-", "")}`,
      kind: "team", person_id: person.id, brand_id: null, username: null,
      password_hash: teamPasswordHash, active: person.active,
    });
  }
  const guestAccounts: DemoRow[] = [
    { id: "demo-guest-aurora", kind: "guest", person_id: null, brand_id: "demo-aurora", username: "guest.aurora", password_hash: guestPasswordHash, active: 1 },
    { id: "demo-guest-mavirota", kind: "guest", person_id: null, brand_id: "demo-mavirota", username: "guest.mavirota", password_hash: guestPasswordHash, active: 1 },
    { id: "demo-guest-novayapi", kind: "guest", person_id: null, brand_id: "demo-novayapi", username: "guest.novayapi", password_hash: guestPasswordHash, active: 1 },
    { id: "demo-guest-luna", kind: "guest", person_id: null, brand_id: "demo-luna", username: "guest.luna", password_hash: guestPasswordHash, active: 0 },
  ];
  guestAccounts.forEach((row) => insert("accounts", row));

  [
    ["demo-ayse", "demo-aurora"], ["demo-ayse", "demo-luna"],
    ["demo-burak", "demo-aurora"], ["demo-burak", "demo-mavirota"],
    ["demo-deniz", "demo-novayapi"], ["demo-deniz", "demo-kentbahce"],
    ["demo-emre", "demo-mavirota"], ["demo-admin", "demo-aurora"],
  ].forEach(([person_id, brand_id]) => insert("person_brand_assignments", { person_id, brand_id, assigned_by: "demo-admin" }));
  [
    ["demo-admin", "demo-aurora"], ["demo-ayse", "demo-luna"], ["demo-burak", "demo-aurora"],
    ["demo-deniz", "demo-novayapi"], ["demo-emre", "demo-mavirota"],
  ].forEach(([person_id, brand_id]) => insert("person_active_work", { person_id, brand_id, updated_at: timestampFromNow(0, 9) }));

  insert("brand_relations", { id: "demo-relation-1", brand_id: "demo-aurora", related_brand_id: "demo-luna", relation_type: "ortaklik_muhtemel", risk_level: "yok", note: "Sağlıklı yaşam etkinliği için kahve tadımı ortaklığı düşünülebilir." });
  insert("brand_relations", { id: "demo-relation-2", brand_id: "demo-novayapi", related_brand_id: "demo-mavirota", relation_type: "kismi_cakisma", risk_level: "dusuk", note: "Marina projesinde kompozit zemin uygulaması üzerinden içerik ortaklığı olabilir." });
  insert("brand_audits", { brand_id: "demo-aurora", body_markdown: "# Demo marka denetimi\n\n## Güçlü yanlar\n- Ürün çekimleri tutarlı\n- Yorumlarda yüksek satın alma niyeti\n\n## Açıklar\n- İnsan hikâyesi eksik\n- Highlight mimarisi güncel değil", source_file: "demo-audit.md", audit_date: dateFromToday(-10), updated_at: timestampFromNow(-2) });

  const contents: DemoRow[] = [
    { id: "demo-content-aurora-launch", brand_id: "demo-aurora", title: "Yaz Menüsü Lansmanı", type: "Kampanya", target_date: dateFromToday(8), status: "Uretimde", assignee_id: "demo-ayse", archived: 0, created_at: timestampFromNow(-18), updated_at: timestampFromNow(-1) },
    { id: "demo-content-aurora-barista", brand_id: "demo-aurora", title: "Barista İpuçları Reel Serisi", type: "Reel", target_date: dateFromToday(18), status: "Planlandi", assignee_id: "demo-burak", archived: 0, created_at: timestampFromNow(-8), updated_at: timestampFromNow(-1) },
    { id: "demo-content-mavirota-tour", brand_id: "demo-mavirota", title: "Yeni Model Tekne Turu", type: "Video", target_date: dateFromToday(12), status: "Uretimde", assignee_id: "demo-emre", archived: 0, created_at: timestampFromNow(-16), updated_at: timestampFromNow(-1) },
    { id: "demo-content-mavirota-guest", brand_id: "demo-mavirota", title: "Guest Talepleri", type: "Diger", target_date: null, status: "Planlandi", assignee_id: null, archived: 0, created_at: timestampFromNow(-5), updated_at: timestampFromNow(-1) },
    { id: "demo-content-nova-case", brand_id: "demo-novayapi", title: "Şantiye Öncesi / Sonrası", type: "Carousel", target_date: dateFromToday(5), status: "Uretimde", assignee_id: "demo-deniz", archived: 0, created_at: timestampFromNow(-20), updated_at: timestampFromNow(-1) },
    { id: "demo-content-luna-expert", brand_id: "demo-luna", title: "Uzmanla 60 Saniye", type: "Reel", target_date: dateFromToday(15), status: "Uretimde", assignee_id: "demo-ayse", archived: 0, created_at: timestampFromNow(-14), updated_at: timestampFromNow(-1) },
    { id: "demo-content-kent-plan", brand_id: "demo-kentbahce", title: "İlk 30 Gün İçerik Planı", type: "Diger", target_date: null, status: "Planlandi", assignee_id: "demo-deniz", archived: 0, created_at: timestampFromNow(-4), updated_at: timestampFromNow(-1) },
    { id: "demo-content-archive", brand_id: "demo-arsivmarka", title: "Tamamlanan Bahar Kampanyası", type: "Kampanya", target_date: dateFromToday(-45), status: "Tamamlandi", assignee_id: "demo-burak", archived: 1, created_at: timestampFromNow(-70), updated_at: timestampFromNow(-40) },
  ];
  contents.forEach((row) => insert("content_items", row));

  addTask({ id: "demo-task-brief", content_item_id: "demo-content-aurora-launch", title: "Kampanya briefini netleştir", status: "Yayinlandi", priority: "Normal", difficulty: "Kolay", assignee_id: "demo-ayse", due_date: dateFromToday(-8), weight_points: 5, completed_at: timestampFromNow(-9, 16), completed_by: "demo-ayse", created_at: timestampFromNow(-18), updated_at: timestampFromNow(-9) });
  addTask({ id: "demo-task-shoot", content_item_id: "demo-content-aurora-launch", title: "Ürün çekimini tamamla", status: "Onaylandi", priority: "Yuksek", difficulty: "Zor", assignee_id: "demo-emre", due_date: dateFromToday(-2), notes: "Dört soğuk içecek ve iki lifestyle sahne çekilecek.", weight_points: 30, created_at: timestampFromNow(-15), updated_at: timestampFromNow(-1) });
  addTask({ id: "demo-task-edit", content_item_id: "demo-content-aurora-launch", title: "Lansman Reel kurgusu", status: "Incelemede", priority: "Acil", difficulty: "Ozel", assignee_id: "demo-burak", due_date: dateFromToday(1), notes: "V2 teslim edildi; müşteri logo süresini kontrol ediyor.", weight_points: 40, created_at: timestampFromNow(-12), updated_at: timestampFromNow(0, 8) });
  addTask({ id: "demo-task-story", content_item_id: "demo-content-aurora-launch", title: "Story geri sayım seti", status: "DevamEdiyor", priority: "Normal", difficulty: "Orta", assignee_id: "demo-deniz", due_date: dateFromToday(3), weight_points: 15 });
  addTask({ id: "demo-task-report", content_item_id: "demo-content-aurora-launch", title: "İlk hafta performans raporu", status: "Beklemede", priority: "Dusuk", difficulty: "Kolay", assignee_id: "demo-ayse", due_date: dateFromToday(14), weight_points: 10 });
  addTask({ id: "demo-task-overdue", content_item_id: "demo-content-aurora-barista", title: "Bölüm başlıklarını çıkar", status: "Beklemede", priority: "Yuksek", difficulty: "Orta", assignee_id: "demo-ayse", due_date: dateFromToday(-4), weight_points: 20 });
  addTask({ id: "demo-task-repeat", content_item_id: "demo-content-aurora-barista", title: "Haftalık Reel yayını", status: "DevamEdiyor", priority: "Normal", difficulty: "Orta", assignee_id: "demo-burak", due_date: dateFromToday(5), repeat_days: 7, weight_points: 25 });
  addTask({ id: "demo-task-marine-script", content_item_id: "demo-content-mavirota-tour", title: "Tekne turu senaryosu", status: "Yayinlandi", priority: "Normal", difficulty: "Orta", assignee_id: "demo-ayse", due_date: dateFromToday(-6), completed_at: timestampFromNow(-6, 15), completed_by: "demo-ayse", weight_points: 15 });
  addTask({ id: "demo-task-marine-shoot", content_item_id: "demo-content-mavirota-tour", title: "Marina çekimi", status: "DevamEdiyor", priority: "Acil", difficulty: "Zor", assignee_id: "demo-emre", due_date: dateFromToday(2), notes: "Hava durumuna göre sabah 06.30 çağrı planı.", weight_points: 50 });
  addTask({ id: "demo-task-marine-edit", content_item_id: "demo-content-mavirota-tour", title: "Ana film ve üç dikey kesit", status: "Beklemede", priority: "Yuksek", difficulty: "Ozel", assignee_id: "demo-burak", due_date: dateFromToday(9), weight_points: 35 });
  addTask({ id: "demo-task-guest-unplanned", content_item_id: "demo-content-mavirota-guest", title: "Guest · Yeni aksesuar tanıtımı", status: "Beklemede", priority: "Normal", difficulty: null, assignee_id: null, due_date: null, notes: null, weight_points: 1, origin: "guest", requested_date: dateFromToday(10), guest_brief: "Yeni güneş tentesini öne çıkaran kısa bir video rica ediyoruz.", created_by_account_id: "demo-guest-mavirota", created_at: timestampFromNow(-2), updated_at: timestampFromNow(-1) });
  addTask({ id: "demo-task-guest-planned", content_item_id: "demo-content-mavirota-guest", title: "Guest · Fuar duyurusu", status: "DevamEdiyor", priority: "Yuksek", difficulty: "Orta", assignee_id: "demo-deniz", due_date: dateFromToday(6), notes: "İç plan: iki format üretilecek.", weight_points: 20, origin: "guest", requested_date: dateFromToday(4), guest_brief: "Fuar standı ve tarih bilgisini içeren duyuru tasarımı.", created_by_account_id: "demo-guest-mavirota", created_at: timestampFromNow(-7), updated_at: timestampFromNow(-1) });
  addTask({ id: "demo-task-nova-copy", content_item_id: "demo-content-nova-case", title: "Vaka metnini yaz", status: "Onaylandi", priority: "Normal", difficulty: "Orta", assignee_id: "demo-ayse", due_date: dateFromToday(-1), weight_points: 25 });
  addTask({ id: "demo-task-nova-design", content_item_id: "demo-content-nova-case", title: "8 kare carousel tasarımı", status: "Incelemede", priority: "Yuksek", difficulty: "Zor", assignee_id: "demo-deniz", due_date: dateFromToday(2), weight_points: 55 });
  addTask({ id: "demo-task-nova-publish", content_item_id: "demo-content-nova-case", title: "LinkedIn uyarlaması ve yayın", status: "Beklemede", priority: "Dusuk", difficulty: "Kolay", assignee_id: "demo-ayse", due_date: dateFromToday(5), weight_points: 20 });
  addTask({ id: "demo-task-luna-questions", content_item_id: "demo-content-luna-expert", title: "Uzman soru havuzu", status: "Yayinlandi", priority: "Normal", difficulty: "Kolay", assignee_id: "demo-ayse", due_date: dateFromToday(-5), completed_at: timestampFromNow(-5, 14), completed_by: "demo-ayse", weight_points: 15 });
  addTask({ id: "demo-task-luna-shoot", content_item_id: "demo-content-luna-expert", title: "Dört bölüm çekimi", status: "DevamEdiyor", priority: "Yuksek", difficulty: "Zor", assignee_id: "demo-emre", due_date: dateFromToday(4), weight_points: 50 });
  addTask({ id: "demo-task-luna-covers", content_item_id: "demo-content-luna-expert", title: "Seri kapak sistemi", status: "Beklemede", priority: "Normal", difficulty: "Orta", assignee_id: "demo-deniz", due_date: dateFromToday(7), weight_points: 35 });
  addTask({ id: "demo-task-undated", content_item_id: "demo-content-kent-plan", title: "Eski tarihsiz görev örneği", status: "Beklemede", priority: "Normal", difficulty: "Orta", assignee_id: "demo-deniz", due_date: null, notes: "Migration öncesi tarihsiz görev görünümünü test eder.", weight_points: 10, created_at: timestampFromNow(-100) });
  addTask({ id: "demo-task-archived", content_item_id: "demo-content-archive", title: "Bahar kampanyası final yayını", status: "Yayinlandi", priority: "Normal", difficulty: "Orta", assignee_id: "demo-burak", due_date: dateFromToday(-45), weight_points: 20, completed_at: timestampFromNow(-44), completed_by: "demo-burak", archived_at: timestampFromNow(-35), created_at: timestampFromNow(-60), updated_at: timestampFromNow(-35) });

  insert("task_personal_targets", { task_id: "demo-task-edit", person_id: "demo-burak", target_date: dateFromToday(0) });
  insert("task_personal_targets", { task_id: "demo-task-story", person_id: "demo-deniz", target_date: dateFromToday(2) });
  insert("task_personal_targets", { task_id: "demo-task-marine-shoot", person_id: "demo-emre", target_date: dateFromToday(1) });

  [
    ["demo-status-1", "demo-task-edit", "Beklemede", "DevamEdiyor", "demo-burak", -6],
    ["demo-status-2", "demo-task-edit", "DevamEdiyor", "Incelemede", "demo-burak", -1],
    ["demo-status-3", "demo-task-shoot", "Incelemede", "Onaylandi", "demo-admin", -1],
    ["demo-status-4", "demo-task-brief", "Onaylandi", "Yayinlandi", "demo-ayse", -9],
  ].forEach(([id, task_id, from_status, to_status, actor_id, offset]) => insert("task_status_events", { id, task_id, from_status, to_status, actor_id, created_at: timestampFromNow(Number(offset), 16) }));

  insert("task_templates", { id: "demo-template-reel", name: "Demo · Reel üretim akışı", content_type: "Reel", sort_order: 10 });
  insert("task_templates", { id: "demo-template-shoot", name: "Demo · Çekim günü hazırlığı", content_type: "Video", sort_order: 20 });
  [
    ["demo-template-item-1", "demo-template-reel", "Brief ve hook", "Normal", "Orta", "demo-ayse", -7, 10],
    ["demo-template-item-2", "demo-template-reel", "Kurgu", "Yuksek", "Zor", "demo-burak", -3, 20],
    ["demo-template-item-3", "demo-template-reel", "Kapak ve altyazı", "Normal", "Orta", "demo-deniz", -1, 30],
    ["demo-template-item-4", "demo-template-shoot", "Call sheet", "Yuksek", "Orta", "demo-emre", -2, 10],
  ].forEach(([id, template_id, title, priority, difficulty, assignee_id, due_offset_days, sort_order]) => insert("task_template_items", { id, template_id, title, priority, difficulty, assignee_id, due_offset_days, sort_order }));

  insert("comments", { id: "demo-comment-1", task_id: "demo-task-edit", author_id: "demo-ayse", body: "İlk üç saniyede ürün daha erken görünmeli. @Burak Test", created_at: timestampFromNow(-1, 9) });
  insert("comments", { id: "demo-comment-2", task_id: "demo-task-edit", author_id: "demo-burak", body: "V2'de açılışı hızlandırdım ve logo süresini düzelttim.", created_at: timestampFromNow(-1, 13) });
  insert("comments", { id: "demo-comment-3", task_id: "demo-task-marine-shoot", author_id: "demo-emre", body: "Hava kontrolü yapıldı; yedek çekim günü cuma.", created_at: timestampFromNow(0, 8) });
  insert("task_attachments", { id: "demo-task-attachment-1", task_id: "demo-task-shoot", file_path: "/uploads/tasks/demo-task.png", original_name: "demo-cekim-briefi.png" });
  insert("comment_attachments", { id: "demo-comment-attachment-1", comment_id: "demo-comment-1", file_path: "/uploads/comments/demo-comment.png", original_name: "demo-referans.png" });

  insert("task_revision_rounds", { id: "demo-revision-1", task_id: "demo-task-edit", round_number: 1, target_minutes: 90, note: "Açılış ritmi ve logo süresi", started_at: timestampFromNow(-3, 10), completed_at: timestampFromNow(-2, 15), created_by: "demo-admin", completed_by: "demo-burak", created_at: timestampFromNow(-3, 10), updated_at: timestampFromNow(-2, 15) });
  insert("task_revision_rounds", { id: "demo-revision-2", task_id: "demo-task-edit", round_number: 2, target_minutes: 60, note: "Renk tonu son kontrol", started_at: timestampFromNow(-1, 14), completed_at: null, created_by: "demo-admin", completed_by: null, created_at: timestampFromNow(-1, 14), updated_at: timestampFromNow(-1, 14) });

  insert("task_deliveries", { id: "demo-delivery-v1", task_id: "demo-task-edit", version_number: 1, note: "İlk kurgu", external_url: "https://example.com/demo/aurora-v1", guest_visible: 0, status: "RevizeIstendi", submitted_by_account_id: "demo-account-burak", submitted_by_name: "Burak Test", submitted_at: timestampFromNow(-3, 17), decision_actor_kind: "team", decided_by_account_id: "demo-account-admin", decided_by_name: "Demo Yönetici", decision_note: "Açılış kısalsın ve ürün bir saniye erken gelsin.", revision_reason: "Tasarim", decided_at: timestampFromNow(-3, 19), created_at: timestampFromNow(-3, 17), updated_at: timestampFromNow(-3, 19) });
  insert("task_deliveries", { id: "demo-delivery-v2", task_id: "demo-task-edit", version_number: 2, note: "Revize edilmiş kurgu", external_url: "https://example.com/demo/aurora-v2", guest_visible: 0, status: "Beklemede", submitted_by_account_id: "demo-account-burak", submitted_by_name: "Burak Test", submitted_at: timestampFromNow(-1, 16), decision_actor_kind: null, decided_by_account_id: null, decided_by_name: null, decision_note: null, revision_reason: null, decided_at: null, created_at: timestampFromNow(-1, 16), updated_at: timestampFromNow(-1, 16) });
  insert("task_deliveries", { id: "demo-delivery-guest", task_id: "demo-task-guest-planned", version_number: 1, note: "İlk tasarım alternatifi", external_url: "https://example.com/demo/fuar-duyurusu", guest_visible: 1, status: "Onaylandi", submitted_by_account_id: "demo-account-deniz", submitted_by_name: "Deniz Test", submitted_at: timestampFromNow(-2, 15), decision_actor_kind: "guest", decided_by_account_id: "demo-guest-mavirota", decided_by_name: "Mavi Rota Denizcilik Guest", decision_note: "İkinci alternatif onaylandı.", revision_reason: null, decided_at: timestampFromNow(-1, 11), created_at: timestampFromNow(-2, 15), updated_at: timestampFromNow(-1, 11) });
  insert("task_delivery_attachments", { id: "demo-delivery-attachment-1", delivery_id: "demo-delivery-v2", file_path: "/uploads/deliveries/demo-delivery.png", original_name: "demo-v2-onizleme.png" });

  insert("task_shared_comments", { id: "demo-shared-comment-1", task_id: "demo-task-guest-planned", account_id: "demo-guest-mavirota", author_name: "Mavi Rota Denizcilik Guest", body: "Tarih satırını biraz daha büyük kullanabilir miyiz?", created_at: timestampFromNow(-3, 12), updated_at: timestampFromNow(-3, 12) });
  insert("task_shared_comments", { id: "demo-shared-comment-2", task_id: "demo-task-guest-planned", account_id: "demo-account-deniz", author_name: "Deniz Test", body: "Güncellenmiş tasarımı teslimler alanına ekledim.", created_at: timestampFromNow(-2, 15), updated_at: timestampFromNow(-2, 15) });
  insert("task_shared_attachments", { id: "demo-shared-attachment-1", task_id: "demo-task-guest-planned", account_id: "demo-guest-mavirota", file_path: "/uploads/guest-tasks/demo-guest-reference.png", original_name: "demo-fuar-referansi.png" });

  const requests: DemoRow[] = [
    { id: "demo-request-new", brand_id: "demo-aurora", title: "Yeni şube açılış duyurusu", description: "Açılış tarihini ve harita bilgisini içeren sosyal medya seti.", requested_by_name: "Demo Müşteri", source: "E-posta", reference_url: "https://example.com/demo/brief", department: "design", content_type: "Post", status: "Beklemede", priority: "Normal", assignee_id: null, due_date: dateFromToday(12), created_by_id: "demo-ayse", reviewed_by_id: null, converted_task_id: null, reviewed_at: null, archived_at: null, created_at: timestampFromNow(-2), updated_at: timestampFromNow(-2) },
    { id: "demo-request-review", brand_id: "demo-novayapi", title: "Teknik ürün karşılaştırması", description: "Üç yalıtım ürününü karar kriterleriyle karşılaştıran carousel.", requested_by_name: "Demo Satış Ekibi", source: "Toplantı", reference_url: null, department: "design", content_type: "Carousel", status: "Incelemede", priority: "Yuksek", assignee_id: "demo-deniz", due_date: dateFromToday(7), created_by_id: "demo-admin", reviewed_by_id: "demo-admin", converted_task_id: null, reviewed_at: timestampFromNow(-1), archived_at: null, created_at: timestampFromNow(-4), updated_at: timestampFromNow(-1) },
    { id: "demo-request-approved", brand_id: "demo-mavirota", title: "Fuar duyurusu", description: "Guest talebinden göreve dönüştürülen örnek.", requested_by_name: "Mavi Rota Demo", source: "Guest paneli", reference_url: null, department: "design", content_type: "Post", status: "Onaylandi", priority: "Yuksek", assignee_id: "demo-deniz", due_date: dateFromToday(6), created_by_id: "demo-admin", reviewed_by_id: "demo-admin", converted_task_id: "demo-task-guest-planned", reviewed_at: timestampFromNow(-6), archived_at: null, created_at: timestampFromNow(-8), updated_at: timestampFromNow(-6) },
    { id: "demo-request-archived", brand_id: "demo-luna", title: "Geçmiş kampanya talebi", description: "Reddedilmiş ve arşivlenmiş talep görünümünü test eder.", requested_by_name: "Demo Müşteri", source: "WhatsApp", reference_url: null, department: "video", content_type: "Video", status: "Reddedildi", priority: "Dusuk", assignee_id: null, due_date: dateFromToday(-20), created_by_id: "demo-ayse", reviewed_by_id: "demo-admin", converted_task_id: null, reviewed_at: timestampFromNow(-20), archived_at: timestampFromNow(-10), created_at: timestampFromNow(-25), updated_at: timestampFromNow(-10) },
  ];
  requests.forEach((row) => insert("client_requests", row));
  insert("client_request_comments", { id: "demo-request-comment-1", request_id: "demo-request-review", author_id: "demo-admin", body: "Teknik veri tablosu müşteriden bekleniyor.", created_at: timestampFromNow(-1, 12) });
  insert("client_request_comments", { id: "demo-request-comment-2", request_id: "demo-request-archived", author_id: "demo-admin", body: "Bütçe onayı olmadığı için bu dönem ilerlemiyoruz.", created_at: timestampFromNow(-20, 14) });
  insert("client_request_attachments", { id: "demo-request-attachment-1", request_id: "demo-request-new", file_path: "/uploads/requests/demo-request.png", original_name: "demo-acilis-briefi.png" });

  const ideas: DemoRow[] = [
    { id: "demo-idea-1", scope_type: "brand", brand_id: "demo-aurora", brand_name_snapshot: "Aurora Coffee Lab", category: "Icerik", status: "Yeni", title: "Bir çekirdeğin 30 saniyelik yolculuğu", body: "Hasattan fincana kadar hızlı makro geçişlerle anlatılan Reel fikri.", source_url: "https://www.instagram.com/reel/demo-aurora", source_platform: "Instagram", tags_text: "reel, ürün, hikâye", created_by_id: "demo-ayse", created_by_name: "Ayşe Test", archived_at: null, created_at: timestampFromNow(-2), updated_at: timestampFromNow(-2) },
    { id: "demo-idea-2", scope_type: "brand", brand_id: "demo-mavirota", brand_name_snapshot: "Mavi Rota Denizcilik", category: "Kampanya", status: "Gelistiriliyor", title: "Kaptana Sor", body: "Her hafta gerçek bir kullanıcı sorusuna kaptanın teknede cevap verdiği seri.", source_url: "https://www.youtube.com/watch?v=demo", source_platform: "YouTube", tags_text: "sss, seri, uzmanlık", created_by_id: "demo-emre", created_by_name: "Emre Test", archived_at: null, created_at: timestampFromNow(-6), updated_at: timestampFromNow(-1) },
    { id: "demo-idea-3", scope_type: "brand", brand_id: "demo-novayapi", brand_name_snapshot: "Nova Yapı Sistemleri", category: "Gorsel", status: "Hazir", title: "Katmanları gösteren kesit animasyonu", body: "Yalıtım uygulamasını katman katman açan izometrik hareketli grafik.", source_url: "https://www.pinterest.com/pin/demo", source_platform: "Pinterest", tags_text: "motion, teknik, eğitim", created_by_id: "demo-deniz", created_by_name: "Deniz Test", archived_at: null, created_at: timestampFromNow(-9), updated_at: timestampFromNow(-2) },
    { id: "demo-idea-4", scope_type: "brand", brand_id: "demo-luna", brand_name_snapshot: "Luna Wellness Studio", category: "Strateji", status: "Kullanildi", title: "Eğitmen günlükleri", body: "Eğitmenlerin bir çalışma gününü kısa bölümlerle anlatan güven serisi.", source_url: "https://www.tiktok.com/@demo/video/1", source_platform: "TikTok", tags_text: "insan, güven, seri", created_by_id: "demo-ayse", created_by_name: "Ayşe Test", archived_at: null, created_at: timestampFromNow(-20), updated_at: timestampFromNow(-5) },
    { id: "demo-idea-5", scope_type: "office", brand_id: null, brand_name_snapshot: null, category: "Ofis", status: "Yeni", title: "Haftalık yaratıcı kritik saati", body: "Cuma günü herkesin tek bir işi getirip 15 dakikalık yapılandırılmış geri bildirim aldığı format.", source_url: null, source_platform: null, tags_text: "ofis, süreç, ekip", created_by_id: "demo-admin", created_by_name: "Demo Yönetici", archived_at: null, created_at: timestampFromNow(-1), updated_at: timestampFromNow(-1) },
    { id: "demo-idea-6", scope_type: "office", brand_id: null, brand_name_snapshot: null, category: "Diger", status: "Gelistiriliyor", title: "Stüdyo ekipman kontrol panosu", body: "Çekim öncesi ekipman durumunu QR kod ile işaretleme fikri.", source_url: "https://example.com/demo/equipment", source_platform: "Web", tags_text: "operasyon, ekipman", created_by_id: "demo-emre", created_by_name: "Emre Test", archived_at: null, created_at: timestampFromNow(-7), updated_at: timestampFromNow(-3) },
    { id: "demo-idea-archived", scope_type: "brand", brand_id: "demo-aurora", brand_name_snapshot: "Aurora Coffee Lab", category: "Icerik", status: "Kullanildi", title: "Arşivlenmiş latte art fikri", body: "Arşiv filtresini göstermek için örnek fikir.", source_url: null, source_platform: null, tags_text: "arşiv", created_by_id: "demo-deniz", created_by_name: "Deniz Test", archived_at: timestampFromNow(-10), created_at: timestampFromNow(-30), updated_at: timestampFromNow(-10) },
  ];
  ideas.forEach((row) => insert("ideas", row));

  const calendarEvents: DemoRow[] = [
    { id: "demo-event-today", brand_id: "demo-aurora", type: "Toplanti", color_key: "purple", title: "Aylık içerik toplantısı", description: "Ayın üretim planı ve kampanya onayı.", start_at: `${dateFromToday(0)} 11:00:00`, end_at: `${dateFromToday(0)} 12:00:00`, all_day: 0, location: "Toplantı Odası", guest_visible: 1, google_event_id: null, google_etag: null, google_updated_at: null, sync_status: "synced", sync_error: null, deleted_at: null, created_by_account_id: "demo-account-admin", created_at: timestampFromNow(-2), updated_at: timestampFromNow(-1), last_synced_at: timestampFromNow(-1) },
    { id: "demo-event-multiday", brand_id: "demo-mavirota", type: "Cekim", color_key: "cyan", title: "Marina çekim kampı", description: "Çok günlük kesintisiz etkinlik çubuğu örneği.", start_at: `${dateFromToday(1)} 00:00:00`, end_at: `${dateFromToday(4)} 00:00:00`, all_day: 1, location: "Demo Marina", guest_visible: 1, google_event_id: null, google_etag: null, google_updated_at: null, sync_status: "synced", sync_error: null, deleted_at: null, created_by_account_id: "demo-account-admin", created_at: timestampFromNow(-3), updated_at: timestampFromNow(-1), last_synced_at: timestampFromNow(-1) },
    { id: "demo-event-office", brand_id: null, type: "Diger", color_key: "amber", title: "Ajans genel değerlendirme", description: "Markasız ajans etkinliği örneği.", start_at: `${dateFromToday(2)} 16:00:00`, end_at: `${dateFromToday(2)} 17:30:00`, all_day: 0, location: "Stüdyo", guest_visible: 0, google_event_id: null, google_etag: null, google_updated_at: null, sync_status: "synced", sync_error: null, deleted_at: null, created_by_account_id: "demo-account-admin", created_at: timestampFromNow(-1), updated_at: timestampFromNow(-1), last_synced_at: timestampFromNow(-1) },
    { id: "demo-event-nova", brand_id: "demo-novayapi", type: "Toplanti", color_key: "blue", title: "Teknik brief görüşmesi", description: "Yeni carousel için mühendislik verileri.", start_at: `${dateFromToday(6)} 14:00:00`, end_at: `${dateFromToday(6)} 15:00:00`, all_day: 0, location: "Google Meet", guest_visible: 0, google_event_id: null, google_etag: null, google_updated_at: null, sync_status: "pending", sync_error: null, deleted_at: null, created_by_account_id: "demo-account-admin", created_at: timestampFromNow(-1), updated_at: timestampFromNow(-1), last_synced_at: null },
    { id: "demo-event-luna", brand_id: "demo-luna", type: "Cekim", color_key: "rose", title: "Eğitmen portre çekimi", description: "Dört eğitmen için portre ve dikey video.", start_at: `${dateFromToday(9)} 09:00:00`, end_at: `${dateFromToday(9)} 13:00:00`, all_day: 0, location: "Luna Demo Stüdyo", guest_visible: 0, google_event_id: null, google_etag: null, google_updated_at: null, sync_status: "synced", sync_error: null, deleted_at: null, created_by_account_id: "demo-account-emre", created_at: timestampFromNow(-2), updated_at: timestampFromNow(-2), last_synced_at: timestampFromNow(-2) },
    { id: "demo-event-cancelled", brand_id: "demo-aurora", type: "Toplanti", color_key: "slate", title: "İptal edilmiş test toplantısı", description: "Tombstone senaryosu.", start_at: `${dateFromToday(-5)} 10:00:00`, end_at: `${dateFromToday(-5)} 11:00:00`, all_day: 0, location: null, guest_visible: 0, google_event_id: "demo-google-tombstone", google_etag: "demo-etag", google_updated_at: timestampFromNow(-5), sync_status: "synced", sync_error: null, deleted_at: timestampFromNow(-4), created_by_account_id: "demo-account-admin", created_at: timestampFromNow(-8), updated_at: timestampFromNow(-4), last_synced_at: timestampFromNow(-4) },
  ];
  calendarEvents.forEach((row) => insert("calendar_events", row));

  const activities: DemoRow[] = [
    { id: "demo-activity-1", actor_id: "demo-ayse", actor_name: "Ayşe Test", action: "content.create", entity_type: "content", entity_id: "demo-content-aurora-launch", brand_id: "demo-aurora", summary: "Ayşe Test “Yaz Menüsü Lansmanı” içeriğini oluşturdu", created_at: timestampFromNow(-18) },
    { id: "demo-activity-2", actor_id: "demo-burak", actor_name: "Burak Test", action: "task.status", entity_type: "task", entity_id: "demo-task-edit", brand_id: "demo-aurora", summary: "Burak Test “Lansman Reel kurgusu” görevini İncelemede yaptı", created_at: timestampFromNow(-1, 16) },
    { id: "demo-activity-3", actor_id: "demo-admin", actor_name: "Demo Yönetici", action: "delivery.revision", entity_type: "task", entity_id: "demo-task-edit", brand_id: "demo-aurora", summary: "Demo Yönetici V1 teslimi için revize istedi", created_at: timestampFromNow(-3, 19) },
    { id: "demo-activity-4", actor_id: "demo-emre", actor_name: "Emre Test", action: "calendar.create", entity_type: "calendar_event", entity_id: "demo-event-multiday", brand_id: "demo-mavirota", summary: "Emre Test çok günlük marina çekimini planladı", created_at: timestampFromNow(-3, 11) },
    { id: "demo-activity-5", actor_id: "demo-deniz", actor_name: "Deniz Test", action: "idea.create", entity_type: "idea", entity_id: "demo-idea-3", brand_id: "demo-novayapi", summary: "Deniz Test “Katmanları gösteren kesit animasyonu” fikrini ekledi", created_at: timestampFromNow(-9) },
    { id: "demo-activity-6", actor_id: "demo-admin", actor_name: "Demo Yönetici", action: "request.review", entity_type: "request", entity_id: "demo-request-review", brand_id: "demo-novayapi", summary: "Demo Yönetici teknik ürün karşılaştırması talebini incelemeye aldı", created_at: timestampFromNow(-1, 12) },
  ];
  activities.forEach((row) => insert("activity_log", row));

  const notifications: DemoRow[] = [
    { id: "demo-notification-1", recipient_id: "demo-burak", recipient_name: "Burak Test", actor_id: "demo-ayse", actor_name: "Ayşe Test", task_id: "demo-task-edit", calendar_event_id: null, brand_id: "demo-aurora", summary: "Ayşe Test seni bir yorumda etiketledi.", read: 0, created_at: timestampFromNow(-1, 9) },
    { id: "demo-notification-2", recipient_id: "demo-deniz", recipient_name: "Deniz Test", actor_id: "demo-admin", actor_name: "Demo Yönetici", task_id: "demo-task-story", calendar_event_id: null, brand_id: "demo-aurora", summary: "Story geri sayım setinin teslim tarihi güncellendi.", read: 0, created_at: timestampFromNow(-1, 10) },
    { id: "demo-notification-3", recipient_id: "demo-guest-aurora", recipient_name: "Aurora Coffee Lab Guest", actor_id: "demo-admin", actor_name: "Demo Yönetici", task_id: null, calendar_event_id: "demo-event-today", brand_id: "demo-aurora", summary: "Aylık içerik toplantısı guest ile paylaşıldı.", read: 0, created_at: timestampFromNow(-1, 11) },
    { id: "demo-notification-4", recipient_id: "demo-guest-mavirota", recipient_name: "Mavi Rota Denizcilik Guest", actor_id: "demo-admin", actor_name: "Demo Yönetici", task_id: null, calendar_event_id: "demo-event-multiday", brand_id: "demo-mavirota", summary: "Marina çekim kampı guest ile paylaşıldı.", read: 1, created_at: timestampFromNow(-2, 11) },
  ];
  notifications.forEach((row) => insert("notifications", row));

  const posts: DemoRow[] = [
    { id: "demo-post-aurora-1", brand_id: "demo-aurora", platform: "instagram", external_id: "demo-aurora-1", permalink: "https://example.com/demo/post/aurora-1", media_type: "VIDEO", caption: "Demo yaz menüsü", posted_at: timestampFromNow(-1), fetched_at: timestampFromNow(0) },
    { id: "demo-post-aurora-2", brand_id: "demo-aurora", platform: "instagram", external_id: "demo-aurora-2", permalink: "https://example.com/demo/post/aurora-2", media_type: "CAROUSEL_ALBUM", caption: "Demo çekirdek rehberi", posted_at: timestampFromNow(-8), fetched_at: timestampFromNow(0) },
    { id: "demo-post-mavirota-1", brand_id: "demo-mavirota", platform: "instagram", external_id: "demo-mavirota-1", permalink: "https://example.com/demo/post/mavirota-1", media_type: "VIDEO", caption: "Demo tekne turu", posted_at: timestampFromNow(-12), fetched_at: timestampFromNow(0) },
    { id: "demo-post-nova-1", brand_id: "demo-novayapi", platform: "instagram", external_id: "demo-nova-1", permalink: "https://example.com/demo/post/nova-1", media_type: "IMAGE", caption: "Demo saha uygulaması", posted_at: timestampFromNow(-38), fetched_at: timestampFromNow(0) },
    { id: "demo-post-luna-1", brand_id: "demo-luna", platform: "instagram", external_id: "demo-luna-1", permalink: "https://example.com/demo/post/luna-1", media_type: "VIDEO", caption: "Demo uzman serisi", posted_at: timestampFromNow(-3), fetched_at: timestampFromNow(0) },
  ];
  posts.forEach((row) => insert("social_posts", row));
  insert("social_sync_runs", { id: "demo-sync-ok", provider: "demo", status: "ok", accounts: 5, new_posts: 3, error: null, started_at: timestampFromNow(0, 6), finished_at: timestampFromNow(0, 6, 5) });
  insert("social_sync_runs", { id: "demo-sync-error", provider: "demo", status: "error", accounts: 5, new_posts: 0, error: "Demo sağlayıcı zaman aşımı", started_at: timestampFromNow(-1, 6), finished_at: timestampFromNow(-1, 6, 2) });
  [
    ["demo-aurora", "demo.aurora.coffee", -1, "ok", null],
    ["demo-mavirota", "demo.mavirota", -12, "ok", null],
    ["demo-novayapi", "demo.novayapi", -38, "ok", null],
    ["demo-luna", "demo.luna.wellness", -3, "ok", null],
    ["demo-kentbahce", "demo.kentbahce", null, "error", "Demo profil verisi alınamadı"],
  ].forEach(([brand_id, handle, days, last_status, last_error]) => insert("brand_social_state", { brand_id, platform: "instagram", handle, last_post_at: days === null ? null : timestampFromNow(Number(days)), last_checked_at: timestampFromNow(0, 6), last_status, last_error, alerted_at: Number(days) < -30 ? timestampFromNow(-1) : null }));

  const targetRows = [
    ["demo-aurora", 12, 20, 4, 5, 9, 2], ["demo-mavirota", 8, 12, 3, 2, 5, 1],
    ["demo-novayapi", 8, 10, 2, 8, 10, 2], ["demo-luna", 10, 18, 5, 4, 7, 3],
  ];
  for (const [brandId, postTarget, storyTarget, reelsTarget, postReady, storyReady, reelsReady] of targetRows) {
    [["Post", postTarget], ["Story", storyTarget], ["Reels", reelsTarget]].forEach(([kind, monthly_target]) => insert("brand_content_targets", { brand_id: brandId, kind, monthly_target }));
    [["Post", postReady], ["Story", storyReady], ["Reels", reelsReady]].forEach(([kind, ready_count]) => insert("brand_asset_counts", { brand_id: brandId, kind, ready_count }));
  }
  insert("brand_monthly_content_completions", { brand_id: "demo-novayapi", month: monthKey(), completed_by: "demo-admin", completed_at: timestampFromNow(-1) });
  insert("brand_monthly_content_completions", { brand_id: "demo-aurora", month: monthKey(-1), completed_by: "demo-admin", completed_at: timestampFromNow(-20) });
  [
    ["demo-aurora", 3, "Post+Story"], ["demo-aurora", 7, "Reels"], ["demo-aurora", 12, "Post+Reels+Story"],
    ["demo-mavirota", 5, "Reels+Story"], ["demo-mavirota", 14, "Post"],
    ["demo-novayapi", 4, "Linkedin+Post"], ["demo-novayapi", 11, "Post+Story"],
    ["demo-luna", 2, "Story"], ["demo-luna", 9, "Reels"], ["demo-luna", 16, "Post+Story"],
  ].forEach(([brand_id, day, combo]) => insert("brand_plan_entries", { brand_id, plan_date: monthDate(Number(day)), combo }));

  db.exec("COMMIT; PRAGMA foreign_keys = ON;");
} catch (error) {
  db.exec("ROLLBACK; PRAGMA foreign_keys = ON;");
  throw error;
}

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
await fs.rm(uploadRoot, { recursive: true, force: true });
const demoUploads = [
  "logos/demo-aurora.png",
  "tasks/demo-task.png",
  "comments/demo-comment.png",
  "deliveries/demo-delivery.png",
  "guest-tasks/demo-guest-reference.png",
  "requests/demo-request.png",
];
for (const relativePath of demoUploads) {
  const absolutePath = path.join(uploadRoot, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, png);
}

// DELETE sonrası serbest SQLite sayfalarında eski iş metinleri kalmasın.
db.exec("PRAGMA wal_checkpoint(TRUNCATE); VACUUM;");

const integrity = db.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
const foreignKeys = db.prepare("PRAGMA foreign_key_check").all();
if (integrity.integrity_check !== "ok" || foreignKeys.length > 0) {
  throw new Error(`Demo veri doğrulaması başarısız: integrity=${integrity.integrity_check}, fk=${foreignKeys.length}`);
}

const expectedCounts: Record<string, number> = {
  clusters: 4,
  brands: 6,
  people: 7,
  accounts: 11,
  content_items: 8,
  tasks: 20,
  client_requests: 4,
  ideas: 7,
  calendar_events: 6,
  task_deliveries: 3,
};
for (const [table, expected] of Object.entries(expectedCounts)) {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
  if (row.count !== expected) throw new Error(`${table}: ${expected} yerine ${row.count} kayıt oluştu.`);
}

const nonDemoCoreRows = db.prepare(
  `SELECT
     (SELECT COUNT(*) FROM brands WHERE id NOT LIKE 'demo-%') +
     (SELECT COUNT(*) FROM people WHERE id NOT LIKE 'demo-%' AND id != 'cansu') +
     (SELECT COUNT(*) FROM content_items WHERE id NOT LIKE 'demo-%') +
     (SELECT COUNT(*) FROM tasks WHERE id NOT LIKE 'demo-%') +
     (SELECT COUNT(*) FROM ideas WHERE id NOT LIKE 'demo-%') AS count`,
).get() as { count: number };
if (nonDemoCoreRows.count !== 0) throw new Error("Demo dışı çekirdek kayıt kaldı.");

console.log(JSON.stringify({
  database: path.join(repoRoot, "data", "inturlam.db"),
  uploadRoot,
  integrity: integrity.integrity_check,
  foreignKeyErrors: foreignKeys.length,
  uploads: demoUploads.length,
  counts: expectedCounts,
  credentials: {
    team: { users: ["Demo Yönetici", "Ayşe Test", "Burak Test", "Deniz Test", "Emre Test", "Talep İnceleme Demo"], password: TEAM_PASSWORD },
    guests: ["guest.aurora", "guest.mavirota", "guest.novayapi"],
    guestPassword: GUEST_PASSWORD,
  },
}, null, 2));

globalThis.__inturlamDb?.close();
globalThis.__inturlamDb = undefined;
