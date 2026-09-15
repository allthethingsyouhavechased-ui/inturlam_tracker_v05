// Yayın ÖNCESİ salt-okunur kontrol.
//
// Neden var: v06 göçleri `tasks` ve `client_requests` tablolarını CHECK
// kısıtlaması değiştiği için YENİDEN KURUYOR. Yeniden kurma, mevcut satırların
// TAMAMI yeni CHECK'e uyuyorsa çalışır; tek bir tanınmayan durum değeri göçü
// "CHECK constraint failed" ile düşürür (yerel kopyada tam olarak bu oldu:
// şemada hiç yazmayan bir v02 kalıntısı, 'IptalEdildi', canlıda duruyordu).
//
// Bu script veritabanını SALT OKUNUR açar: göç çalıştırmaz, hiçbir şey yazmaz,
// uygulama bootstrap'ını başlatmaz. `getDb()` KULLANILMAZ — o açılışta göçleri
// tetikler (bkz. lib/db/client.ts).
//
// Çalıştırma (sunucuda, yeni kod çekildikten SONRA, servisi yeniden
// başlatmadan ÖNCE):
//   npm run deploy:preflight
//   npm run deploy:preflight -- /tam/yol/inturlam.db

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dbPath = process.argv[2]
  ?? process.env.INTURLAM_DB_PATH
  ?? path.join(process.cwd(), "data", "inturlam.db");
const uploadRoot = process.env.INTURLAM_UPLOAD_ROOT
  ?? path.join(process.cwd(), "data", "uploads");

// v06 sonrası izin verilen değerler. Buradaki listeler lib/db/schema.sql'deki
// CHECK ile AYNI olmalı; ayrışırlarsa bu kontrol yanlış güven verir.
const ALLOWED_TASK_STATUS = [
  "Beklemede", "DevamEdiyor", "Incelemede", "Revizede",
  "Onaylandi", "MusteriIncelemede", "MusteriOnayladi", "Yayinlandi", "IptalEdildi",
];
const ALLOWED_REQUEST_STATUS = [
  "Beklemede", "Incelemede", "BilgiBekleniyor", "Onaylandi", "Reddedildi",
];

const problems: string[] = [];
const notes: string[] = [];

function line(label: string, value: unknown): void {
  console.log(`  ${label.padEnd(28)} ${value}`);
}

console.log("\n=== Yayın öncesi kontrol ===\n");

const [major] = process.versions.node.split(".").map(Number);
line("Node sürümü", process.versions.node);
// node:sqlite Node 22'de geldi; altında uygulama hiç açılmaz.
if (major < 22) problems.push(`Node ${process.versions.node} yetersiz — node:sqlite için en az 22 gerekiyor.`);

line("Veritabanı", dbPath);
if (!fs.existsSync(dbPath)) {
  problems.push(`Veritabanı bulunamadı: ${dbPath}`);
  console.log("\nDURDU: veritabanı yok.\n");
  process.exit(1);
}
line("Veritabanı boyutu", `${(fs.statSync(dbPath).size / 1024 / 1024).toFixed(1)} MB`);
line("Yükleme kökü", fs.existsSync(uploadRoot) ? uploadRoot : `${uploadRoot} (YOK)`);
if (!fs.existsSync(uploadRoot)) notes.push("Yükleme klasörü yok; ilk yüklemede oluşturulacak.");

const db = new DatabaseSync(dbPath, { readOnly: true });

function tableExists(name: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
}

function checkStatuses(table: string, allowed: string[]): void {
  if (!tableExists(table)) { notes.push(`${table} tablosu yok (yeni kurulum olabilir).`); return; }
  const rows = db.prepare(`SELECT status, COUNT(*) AS n FROM "${table}" GROUP BY status ORDER BY n DESC`)
    .all() as { status: string; n: number }[];
  console.log(`\n  ${table}.status dağılımı:`);
  for (const row of rows) {
    const ok = allowed.includes(row.status);
    console.log(`    ${ok ? "  " : "!!"} ${String(row.status).padEnd(20)} ${row.n}`);
    if (!ok) {
      problems.push(
        `${table}.status içinde tanınmayan değer: "${row.status}" (${row.n} satır). ` +
        `Göç bu değeri CHECK'e eklemeden çalışmaz.`,
      );
    }
  }
}

console.log("\n--- Durum değerleri (göçün kritik noktası) ---");
checkStatuses("tasks", ALLOWED_TASK_STATUS);
checkStatuses("client_requests", ALLOWED_REQUEST_STATUS);

console.log("\n--- Göç durumu ---");
if (tableExists("schema_migrations")) {
  const applied = (db.prepare("SELECT id FROM schema_migrations ORDER BY id").all() as { id: string }[])
    .map((row) => row.id);
  line("Uygulanmış göç", applied.length);
  const pending = ["026-ideas-linked-task", "027-task-customer-approval",
    "028-brand-customer-approval-default", "029-client-request-flow",
    "030-client-request-reviewers", "031-work-session-break-alert"]
    .filter((id) => !applied.includes(id));
  line("v06 ile gelecek", pending.length ? pending.join(", ") : "yok (zaten güncel)");
} else {
  notes.push("schema_migrations yok; ilk açılışta tüm göçler bir kez uygulanacak.");
}

console.log("\n--- Veri büyüklüğü ---");
for (const table of ["brands", "people", "tasks", "content_items", "task_deliveries",
  "client_requests", "calendar_events", "activity_log", "notifications"]) {
  if (tableExists(table)) {
    line(table, (db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get() as { n: number }).n);
  }
}

console.log("\n--- Bütünlük ---");
const fk = db.prepare("PRAGMA foreign_key_check").all();
line("foreign_key_check", fk.length === 0 ? "temiz" : `${fk.length} ihlal`);
if (fk.length > 0) problems.push(`${fk.length} foreign key ihlali var; göç öncesi incelenmeli.`);
const integrity = (db.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check;
line("integrity_check", integrity);
if (integrity !== "ok") problems.push(`integrity_check "${integrity}" döndü; veritabanı bozuk olabilir.`);

db.close();

console.log("\n=== Sonuç ===");
for (const note of notes) console.log(`  not: ${note}`);
if (problems.length === 0) {
  console.log("  Engel yok: göç güvenle çalıştırılabilir.\n");
  process.exit(0);
}
console.log("");
for (const problem of problems) console.log(`  ENGEL: ${problem}`);
console.log("\n  Yayını DURDUR; yukarıdaki maddeler çözülmeden servisi yeniden başlatma.\n");
process.exit(1);
