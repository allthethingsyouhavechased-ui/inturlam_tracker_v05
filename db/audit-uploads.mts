import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const dbPath = process.env.INTURLAM_DB_PATH ?? path.join(process.cwd(), "data", "inturlam.db");
const uploadRoot = path.resolve(process.env.INTURLAM_UPLOAD_ROOT ?? path.join(process.cwd(), "data", "uploads"));
const shouldPrune = process.argv.includes("--prune");

function walkFiles(root: string, current = root): string[] {
  if (!fs.existsSync(current)) return [];
  return fs.readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) return walkFiles(root, absolute);
    if (!entry.isFile()) return [];
    return [`/uploads/${path.relative(root, absolute).split(path.sep).join("/")}`];
  });
}

function safeAbsolute(filePath: string): string | null {
  if (!filePath.startsWith("/uploads/")) return null;
  const absolute = path.resolve(uploadRoot, filePath.slice("/uploads/".length));
  const relative = path.relative(uploadRoot, absolute);
  return relative.startsWith("..") || path.isAbsolute(relative) ? null : absolute;
}

if (!fs.existsSync(dbPath)) throw new Error(`Veritabanı bulunamadı: ${dbPath}`);

const db = new DatabaseSync(dbPath, { readOnly: true });
let references: string[];
try {
  const rows = db.prepare(`
    SELECT file_path FROM task_attachments
    UNION SELECT file_path FROM comment_attachments
    UNION SELECT file_path FROM task_delivery_attachments
    UNION SELECT file_path FROM task_shared_attachments
    UNION SELECT file_path FROM client_request_attachments
    UNION SELECT avatar_path AS file_path FROM people WHERE avatar_path IS NOT NULL
    UNION SELECT logo_path AS file_path FROM brands WHERE logo_path IS NOT NULL
  `).all() as Array<{ file_path: string }>;
  references = Array.from(new Set(rows.map((row) => row.file_path).filter((value) => value.startsWith("/uploads/")))).sort();
} finally {
  db.close();
}

const diskFiles = walkFiles(uploadRoot).sort();
const referenceSet = new Set(references);
const diskSet = new Set(diskFiles);
const missing = references.filter((filePath) => !diskSet.has(filePath));
const orphaned = diskFiles.filter((filePath) => !referenceSet.has(filePath));

console.log(`DB referansı: ${references.length}`);
console.log(`Disk dosyası: ${diskFiles.length}`);
console.log(`Eksik dosya: ${missing.length}`);
for (const filePath of missing) console.log(`  MISSING ${filePath}`);
console.log(`Yetim dosya: ${orphaned.length}`);
for (const filePath of orphaned) console.log(`  ORPHAN ${filePath}`);

if (shouldPrune) {
  let removed = 0;
  for (const filePath of orphaned) {
    const absolute = safeAbsolute(filePath);
    if (!absolute) continue;
    fs.unlinkSync(absolute);
    removed += 1;
  }
  console.log(`Temizlenen yetim dosya: ${removed}`);
} else if (orphaned.length > 0) {
  console.log("Temizlemek için: npm run uploads:audit -- --prune");
}

if (missing.length > 0) process.exitCode = 2;
