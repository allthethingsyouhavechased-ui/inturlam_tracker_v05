// Veritabanı + dosya ekleri yedeği.
//
// Çalıştırma:  npm run db:backup
//
// Neden VACUUM INTO (dosya kopyalamak yerine): DB WAL modunda; son yazmalar
// `.db-wal` dosyasında bekliyor olabilir. Sadece `.db`yi kopyalamak sessizce
// eksik veri verir, üçünü birden kopyalamak da kopyalama sırasında yazma
// olursa tutarsız kalabilir. `VACUUM INTO` SQLite'ın kendi tutarlı anlık
// görüntüsü — dev sunucusu DB'yi açık tutarken bile güvenli ve tek dosya
// (WAL/SHM olmadan) üretir.
//
// Bağlantı `getDb()` ÜZERİNDEN AÇILMAZ: o yol şemayı uygular ve migration
// çalıştırır. Yedek alma işlemi veriye asla dokunmamalı.

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DB_PATH =
  process.env.INTURLAM_DB_PATH ?? path.join(process.cwd(), "data", "inturlam.db");
const RUNTIME_UPLOADS_DIR = process.env.INTURLAM_UPLOAD_ROOT ?? path.join(process.cwd(), "data", "uploads");
const LEGACY_UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const UPLOADS_DIR = fs.existsSync(RUNTIME_UPLOADS_DIR)
  ? RUNTIME_UPLOADS_DIR
  : LEGACY_UPLOADS_DIR;
const LOCAL_BACKUP_ROOT = process.env.INTURLAM_BACKUP_ROOT ?? path.join(process.cwd(), "data", "backup");

// Ofis PC ile paylaşılan Drive klasörü gibi ikinci bir hedef verilebilir:
//   INTURLAM_BACKUP_DIR="G:\Drive'ım\INTURLAM_YEDEK" npm run db:backup
const EXTRA_BACKUP_ROOT = process.env.INTURLAM_BACKUP_DIR?.trim() || null;

// Kaç yedek saklanacak (her hedefte ayrı sayılır).
const KEEP = Number(process.env.INTURLAM_BACKUP_KEEP ?? 14);

// Klasör adı: 20260725-154045 — sıralanabilir olsun diye leksikografik.
function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

function humanSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Yedek klasörü adı bu kalıba uymuyorsa rotasyonda ellenmez — yanlışlıkla
// başka bir şeyi silmeyelim.
const STAMP_RE = /^\d{8}-\d{6}$/;

function rotate(root: string, keep: number): number {
  if (!fs.existsSync(root)) return 0;
  const dirs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && STAMP_RE.test(e.name))
    .map((e) => e.name)
    .sort(); // isim = zaman damgası, alfabetik sıra = kronolojik sıra
  const drop = dirs.slice(0, Math.max(0, dirs.length - keep));
  for (const name of drop) {
    fs.rmSync(path.join(root, name), { recursive: true, force: true });
  }
  return drop.length;
}

function main(): void {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`Veritabanı bulunamadı: ${DB_PATH}`);
    process.exit(1);
  }

  const name = stamp();
  const targets = [path.join(LOCAL_BACKUP_ROOT, name)];
  if (EXTRA_BACKUP_ROOT) targets.push(path.join(EXTRA_BACKUP_ROOT, name));

  // Önce yerel hedefe anlık görüntü al, sonra diğer hedeflere kopyala —
  // VACUUM INTO'yu her hedef için ayrı çalıştırmak DB'yi gereksiz meşgul eder
  // ve hedefler arasında farklı anlar yakalanabilir.
  const primary = targets[0];
  fs.mkdirSync(primary, { recursive: true });
  const dbOut = path.join(primary, "inturlam.db");

  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  try {
    // VACUUM INTO hedef dosya VARSA hata verir; klasör yeni olduğu için sorun
    // yok ama aynı saniyede iki kez çalıştırılırsa diye temizliyoruz.
    fs.rmSync(dbOut, { force: true });
    db.exec(`VACUUM INTO '${dbOut.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }

  let uploadCount = 0;
  if (fs.existsSync(UPLOADS_DIR)) {
    fs.cpSync(UPLOADS_DIR, path.join(primary, "uploads"), { recursive: true });
    uploadCount = fs
      .readdirSync(path.join(primary, "uploads"), { recursive: true })
      .filter((f) => typeof f === "string" && path.extname(f)).length;
  }

  for (const target of targets.slice(1)) {
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.cpSync(primary, target, { recursive: true });
    } catch (err) {
      // İkinci hedef (ör. Drive) erişilemezse yerel yedek yine de geçerli —
      // uyar ama işlemi başarısız sayma.
      console.warn(`! İkinci hedefe yazılamadı (${target}): ${(err as Error).message}`);
    }
  }

  const size = fs.statSync(dbOut).size;
  console.log(`Yedek alındı: ${primary} (${humanSize(size)}, ${uploadCount} ek dosya)`);
  if (targets[1] && fs.existsSync(targets[1])) console.log(`Kopya: ${targets[1]}`);

  for (const root of [LOCAL_BACKUP_ROOT, EXTRA_BACKUP_ROOT].filter(Boolean) as string[]) {
    const removed = rotate(root, KEEP);
    if (removed > 0) console.log(`Rotasyon: ${root} içinde ${removed} eski yedek silindi.`);
  }
}

main();
