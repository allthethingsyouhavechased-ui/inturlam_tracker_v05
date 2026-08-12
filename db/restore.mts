// Yedekten geri yükleme.
//
// Çalıştırma:
//   npm run db:restore                      -> yedekleri listeler, hiçbir şey yapmaz
//   npm run db:restore -- 20260725-154045 --force
//
// Kurallar (bilerek sürtünmeli — bu işlem canlı veriyi ezer):
//   1. `--force` olmadan asla yazmaz.
//   2. Yazmadan ÖNCE mevcut DB'nin yedeğini alır (geri dönüş yolu kalsın).
//   3. Dev/prod sunucusu KAPALI olmalı: açık bir bağlantı DB dosyasını
//      değiştirdiğimizi görmez, elindeki eski sayfaları yazıp yedeği bozabilir.

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DB_PATH =
  process.env.INTURLAM_DB_PATH ?? path.join(process.cwd(), "data", "inturlam.db");
const BACKUP_ROOT = process.env.INTURLAM_BACKUP_ROOT ?? path.join(process.cwd(), "data", "backup");
const UPLOADS_DIR = process.env.INTURLAM_UPLOAD_ROOT ?? path.join(process.cwd(), "data", "uploads");

const args = process.argv.slice(2);
const force = args.includes("--force");
const name = args.find((a) => !a.startsWith("--"));

function listBackups(): string[] {
  if (!fs.existsSync(BACKUP_ROOT)) return [];
  return fs
    .readdirSync(BACKUP_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(BACKUP_ROOT, e.name, "inturlam.db")))
    .map((e) => e.name)
    .sort()
    .reverse();
}

const backups = listBackups();

if (!name) {
  if (backups.length === 0) {
    console.log(`Yedek yok (${BACKUP_ROOT}). Önce: npm run db:backup`);
  } else {
    console.log("Mevcut yedekler (yeniden eskiye):");
    for (const b of backups) {
      const size = fs.statSync(path.join(BACKUP_ROOT, b, "inturlam.db")).size;
      console.log(`  ${b}  ${(size / 1024).toFixed(0)} KB`);
    }
    console.log(`\nGeri yüklemek için: npm run db:restore -- ${backups[0]} --force`);
  }
  process.exit(0);
}

const source = path.join(BACKUP_ROOT, name, "inturlam.db");
if (!fs.existsSync(source)) {
  console.error(`Yedek bulunamadı: ${source}`);
  process.exit(1);
}

// Yedeğin sağlam olduğunu YAZMADAN ÖNCE doğrula — bozuk bir yedekle çalışan
// veriyi ezmek en kötü senaryo.
const check = new DatabaseSync(source, { readOnly: true });
try {
  const result = check.prepare("PRAGMA integrity_check").get() as
    | { integrity_check?: string }
    | undefined;
  if (result?.integrity_check !== "ok") {
    console.error(`Yedek bozuk görünüyor (integrity_check: ${result?.integrity_check}). İptal.`);
    process.exit(1);
  }
  const brands = check.prepare("SELECT COUNT(*) c FROM brands").get() as { c: number };
  console.log(`Yedek doğrulandı: ${name} — ${brands.c} marka.`);
} finally {
  check.close();
}

if (!force) {
  console.log("\nBu işlem mevcut veritabanının ÜZERİNE yazar.");
  console.log("Dev/prod sunucusunun kapalı olduğundan emin ol, sonra:");
  console.log(`  npm run db:restore -- ${name} --force`);
  process.exit(0);
}

// Geri dönüş yolu: mevcut DB'yi yanına al.
if (fs.existsSync(DB_PATH)) {
  const safety = path.join(
    BACKUP_ROOT,
    `restore-oncesi-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "").slice(0, 15)}`,
  );
  fs.mkdirSync(safety, { recursive: true });
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  try {
    db.exec(`VACUUM INTO '${path.join(safety, "inturlam.db").replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }
  console.log(`Mevcut veritabanı önce buraya yedeklendi: ${safety}`);
}

// WAL/SHM kalıntısı yeni dosyayla eşleşmez — birlikte silinmeli.
for (const suffix of ["", "-wal", "-shm"]) {
  fs.rmSync(DB_PATH + suffix, { force: true });
}
fs.copyFileSync(source, DB_PATH);

const uploads = path.join(BACKUP_ROOT, name, "uploads");
if (fs.existsSync(uploads)) {
  fs.cpSync(uploads, UPLOADS_DIR, { recursive: true });
  console.log("Dosya ekleri de geri yüklendi.");
}

console.log(`Geri yüklendi: ${name} → ${DB_PATH}`);
