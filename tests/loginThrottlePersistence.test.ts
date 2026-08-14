import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-throttle-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");
const { LoginThrottle } = await import("@/lib/auth/loginThrottle");
const { sqliteLoginAttemptStore } = await import("@/lib/auth/loginThrottleStore");

function resetDb(): void {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(TMP_DB + suffix, { force: true });
}

beforeEach(resetDb);
after(resetDb);

const WINDOW_MS = 15 * 60 * 1000;

function throttle() {
  return new LoginThrottle(5, WINDOW_MS, sqliteLoginAttemptStore(WINDOW_MS));
}

// Denetim bulgusu SEC-03: sayaçlar süreç içi bir Map'te tutuluyordu. Sunucu
// yeniden başlayınca sıfırlanıyor, ikinci bir örnek/worker de aynı hesaba
// sıfırdan 5 deneme daha tanıyordu (N örnek = 5N deneme).

describe("giriş deneme sınırı örnekler arasında paylaşılır", () => {
  it("ikinci bir örnek (worker) aynı hesabı bloklu görür", () => {
    getDb();
    const workerA = throttle();
    for (let attempt = 0; attempt < 5; attempt += 1) workerA.recordFailure("yunus", 0);
    assert.equal(workerA.isBlocked("yunus", 0), true);

    // Yük dengeleyici bir sonraki isteği başka bir örneğe yönlendirse bile
    // sayaç ortak DB'den okunuyor — sınır baypas edilemiyor.
    const workerB = throttle();
    assert.equal(workerB.isBlocked("yunus", 0), true);
  });

  it("başarılı girişte sayacı tüm örnekler için temizler", () => {
    getDb();
    const workerA = throttle();
    for (let attempt = 0; attempt < 5; attempt += 1) workerA.recordFailure("yunus", 0);
    workerA.reset("yunus");
    assert.equal(throttle().isBlocked("yunus", 0), false);
  });

  it("pencere kapandıktan sonra bloke kalkar ve satır budanır", () => {
    getDb();
    const worker = throttle();
    for (let attempt = 0; attempt < 5; attempt += 1) worker.recordFailure("yunus", Date.now());
    assert.equal(worker.isBlocked("yunus", Date.now()), true);
    assert.equal(worker.isBlocked("yunus", Date.now() + WINDOW_MS + 1), false);

    // Budama yazma yolunda çalışıyor: penceresi geçmiş bir kayıt, başka bir
    // hesabın yeni denemesi yazılırken temizlenir.
    worker.recordFailure("baska-hesap", Date.now() + 2 * WINDOW_MS);
    const rows = getDb().prepare("SELECT attempt_key FROM login_attempts").all() as {
      attempt_key: string;
    }[];
    assert.deepEqual(
      rows.map((row) => row.attempt_key),
      ["baska-hesap"],
    );
  });
});
