import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { after, beforeEach, describe, it } from "node:test";

const TMP_ROOT = path.join(os.tmpdir(), `inturlam-v03-logo-${process.pid}`);
const TMP_DB = path.join(TMP_ROOT, "inturlam.db");
const TMP_UPLOADS = path.join(TMP_ROOT, "uploads");
const TMP_BACKUPS = path.join(TMP_ROOT, "backup");
process.env.INTURLAM_DB_PATH = TMP_DB;
process.env.INTURLAM_UPLOAD_ROOT = TMP_UPLOADS;

const { getDb } = await import("@/lib/db/client");
const { replaceBrandLogo } = await import("@/lib/uploads");

function reset() {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  fs.rmSync(TMP_ROOT, { force: true, recursive: true });
  fs.mkdirSync(TMP_ROOT, { recursive: true });
}

function logoFile(name = "logo.png", bytes = [1, 2, 3]): File {
  return new File([new Uint8Array(bytes)], name, { type: "image/png" });
}

function runScript(script: string, args: string[] = []) {
  const result = spawnSync(process.execPath, [path.join(process.cwd(), script), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      INTURLAM_DB_PATH: TMP_DB,
      INTURLAM_UPLOAD_ROOT: TMP_UPLOADS,
      INTURLAM_BACKUP_ROOT: TMP_BACKUPS,
    },
  });
  assert.equal(result.status, 0, `${script} başarısız:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

beforeEach(reset);
after(reset);

describe("v03 marka logosu runtime yaşam döngüsü", () => {
  it("yeni logoyu Git dışındaki logos upload alanında saklar", async () => {
    const savedPath = await replaceBrandLogo(logoFile(), null, (filePath) => filePath);

    assert.match(savedPath, /^\/uploads\/logos\/[0-9a-f-]+\.png$/);
    assert.equal(fs.existsSync(path.join(TMP_UPLOADS, savedPath.replace(/^\/uploads\//, ""))), true);
    assert.equal(savedPath.startsWith("/logos/"), false);
  });

  it("DB yazımı başarısızsa yeni logoyu geri alır ve eski runtime logoyu korur", async () => {
    const oldLogo = path.join(TMP_UPLOADS, "logos", "old.png");
    fs.mkdirSync(path.dirname(oldLogo), { recursive: true });
    fs.writeFileSync(oldLogo, new Uint8Array([9, 9, 9]));

    await assert.rejects(
      replaceBrandLogo(logoFile(), "/uploads/logos/old.png", () => {
        throw new Error("DB failed");
      }),
      /DB failed/,
    );

    assert.equal(fs.existsSync(oldLogo), true);
    assert.deepEqual(fs.readdirSync(path.dirname(oldLogo)), ["old.png"]);
  });

  it("DB yazımı tamamlandıktan sonra eski runtime logoyu temizler ama repo logosuna dokunmaz", async () => {
    const oldRuntimeLogo = path.join(TMP_UPLOADS, "logos", "old.png");
    fs.mkdirSync(path.dirname(oldRuntimeLogo), { recursive: true });
    fs.writeFileSync(oldRuntimeLogo, new Uint8Array([9]));
    const next = await replaceBrandLogo(logoFile("next.png", [4]), "/uploads/logos/old.png", (filePath) => filePath);
    assert.equal(fs.existsSync(oldRuntimeLogo), false);
    assert.equal(fs.existsSync(path.join(TMP_UPLOADS, next.replace(/^\/uploads\//, ""))), true);

    const repoLogo = path.join(process.cwd(), "public", "logos", "adadisticaret.jpg");
    const originalRepoLogo = fs.readFileSync(repoLogo);
    await replaceBrandLogo(logoFile("replacement.png", [5]), "/logos/adadisticaret.jpg", (filePath) => filePath);
    assert.deepEqual(fs.readFileSync(repoLogo), originalRepoLogo);
  });

  it("runtime logoyu DB snapshotıyla birlikte yedekler ve geri yükler", async () => {
    const db = getDb();
    db.prepare("INSERT INTO brands (id,name,cluster,logo_path) VALUES ('b1','Bir','tek','/uploads/logos/brand.png')").run();
    fs.mkdirSync(path.join(TMP_UPLOADS, "logos"), { recursive: true });
    fs.writeFileSync(path.join(TMP_UPLOADS, "logos", "brand.png"), new Uint8Array([7, 8, 9]));
    db.close();
    globalThis.__inturlamDb = undefined;

    runScript("db/backup.mts");
    const backupName = fs.readdirSync(TMP_BACKUPS)[0];
    const backupLogo = path.join(TMP_BACKUPS, backupName, "uploads", "logos", "brand.png");
    assert.deepEqual(fs.readFileSync(backupLogo), Buffer.from([7, 8, 9]));

    fs.rmSync(path.join(TMP_UPLOADS, "logos", "brand.png"));
    runScript("db/restore.mts", [backupName, "--force"]);
    assert.deepEqual(fs.readFileSync(path.join(TMP_UPLOADS, "logos", "brand.png")), Buffer.from([7, 8, 9]));
  });

  it("runtime logo rotasını ekip, guest ve giriş yüzeyleri için güvenli public görsel sayar", () => {
    const route = fs.readFileSync(path.join(process.cwd(), "app/uploads/[...path]/route.ts"), "utf8");
    assert.match(route, /requestedPath\[0\]\s*===\s*["']logos["']/);
    assert.match(route, /public, max-age=3600, must-revalidate/);
  });

  it("marka action akışını atomik runtime logo değişimine bağlar", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "lib/actions/brands.ts"), "utf8");
    assert.match(source, /replaceBrandLogo/);
    assert.doesNotMatch(source, /saveBrandLogo|updateBrandLogo/);
  });
});
