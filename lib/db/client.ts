import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
// Relative + AÇIK `.ts` uzantısı: `db/seed.mts` bu modülü alias hook'u OLMADAN
// (`node db/seed.mts`) çalıştırıyor, orada `@/...` çözülmez. `tsconfig.json`daki
// `allowImportingTsExtensions` bunun için var.
import {
  runPendingMigrations,
  seedClustersIfNeeded,
  seedPointCatalogIfNeeded,
  seedTaskTemplatesIfNeeded,
} from "./migrations.ts";

// Varsayılan tek dosya; `INTURLAM_DB_PATH` ile değiştirilebilir. Bunun tek
// gerçek kullanıcısı testler (geçici DB) ve yedekleme/geri yükleme script'leri —
// gerçek veriye asla dokunmasınlar diye.
const DB_PATH =
  process.env.INTURLAM_DB_PATH ?? path.join(process.cwd(), "data", "inturlam.db");
const SCHEMA_PATH = path.join(process.cwd(), "lib", "db", "schema.sql");

declare global {
  var __inturlamDb: DatabaseSync | undefined;
}

function createConnection(): DatabaseSync {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");
  // Next dev sunucusunun render-worker alt süreçleri her biri kendi ilk DB
  // dokunuşunda bu bağlantıyı açar (globalThis singleton'ı sadece kendi süreci
  // içinde korur); busy_timeout olmadan aynı WAL dosyasına eşzamanlı ilk açılış
  // + migration DDL'i SQLITE_BUSY ile çakışabilir.
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = ON");
  const schemaSql = fs.readFileSync(SCHEMA_PATH, "utf-8");
  try {
    db.exec(schemaSql);
  } catch {
    // schema.sql, henüz migrate edilmemiş eski bir tabloya yeni bir sütun/indeks
    // varsayıyor olabilir (ör. yeni eklenen bir sütun üzerinde CREATE INDEX).
    // Migration'lar tabloyu düzeltir, aşağıda şema ikinci kez uygulanır — o
    // geçişte artık hata vermez. Önceki CREATE TABLE/INDEX ifadeleri bu satıra
    // kadar zaten no-op ya da başarılı şekilde uygulanmış olur.
  }
  // Bekleyen şema göçleri: açık sırayla ve her biri yalnızca bir kez. Sıra,
  // kimlikler ve gerekçeler `lib/db/migrations.ts`te — bu dosya artık yalnızca
  // BAĞLANTI kurar, şema evrimini bilmez.
  runPendingMigrations(db);
  // Göç DEĞİL, uzlaştırma: markaya elle yazılmış yeni bir kategori id'sini
  // `clusters` tablosuna adopte eder. Her açılışta çalışmalı — bkz. migrations.ts.
  seedClustersIfNeeded(db);
  db.exec(schemaSql);
  seedTaskTemplatesIfNeeded(db);
  // Puan kataloğu v1: YALNIZCA hiç sürüm yoksa yazılır (seedTaskTemplates ile
  // aynı gerekçe — yönetici bir kalemi düzeltmişse geri gelmesin).
  seedPointCatalogIfNeeded(db);
  return db;
}

export function getDb(): DatabaseSync {
  if (!globalThis.__inturlamDb) {
    globalThis.__inturlamDb = createConnection();
  }
  return globalThis.__inturlamDb;
}

// node:sqlite satırları null-prototype obje döner; React bunları Client
// Component'lere geçiremiyor. Düz objeye çevirerek her yerde güvenli kılıyoruz.
export function plainList<T>(rows: unknown[]): T[] {
  return rows.map((r) => ({ ...(r as Record<string, unknown>) }) as T);
}

export function plainOne<T>(row: unknown): T | undefined {
  return row == null
    ? undefined
    : ({ ...(row as Record<string, unknown>) } as T);
}
