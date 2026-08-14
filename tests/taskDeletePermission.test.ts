import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { assertCanDeleteTasks, canDeleteTasks } from "@/lib/auth/authorization";

// Görev silme yalnız yöneticilere açık (2026-08-14 talebi). Panodaki diğer
// işlemler ortak iş havuzu mantığıyla herkeste kalıyor; silme ayrıldı çünkü
// geri alınamayan tek işlem o.

describe("görev silme yetkisi", () => {
  it("yalnızca yöneticilere izin verir", () => {
    assert.equal(canDeleteTasks({ is_manager: 1 }), true);
    assert.equal(canDeleteTasks({ is_manager: 0 }), false);
    assert.equal(canDeleteTasks(null), false);
    assert.equal(canDeleteTasks(undefined), false);
  });

  it("yetkisiz kişiyi anlaşılır bir hatayla reddeder", () => {
    assert.doesNotThrow(() => assertCanDeleteTasks({ is_manager: 1 }));
    assert.throws(() => assertCanDeleteTasks({ is_manager: 0 }), /yalnızca yöneticilerde/);
  });

  it("silme action'ları yetkiyi SUNUCUDA yeniden doğrular", () => {
    // Arayüzde düğmeyi gizlemek yeterli değil: Server Action'a doğrudan istek
    // atılabilir. Bu yüzden iki silme action'ının da guard'ı çağırdığı
    // kaynaktan doğrulanıyor — biri sonradan eklenip guard unutulmasın.
    // v03'te guard `requireManager()`; `canDeleteTasks` ile aynı kuralı
    // (`is_manager === 1`) uyguluyor, arayüz tarafı o yardımcıyı kullanıyor.
    const source = fs.readFileSync(
      path.join(process.cwd(), "lib", "actions", "tasks.ts"),
      "utf8",
    );
    for (const actionName of ["deleteTaskAction", "bulkDeleteTasksAction"]) {
      const start = source.indexOf(`export async function ${actionName}`);
      assert.ok(start > -1, `${actionName} bulunamadı.`);
      // Gövde = bu bildirimden bir sonraki top-level `export`a kadar.
      const nextExport = source.indexOf("\nexport ", start + 1);
      const body = source.slice(start, nextExport === -1 ? undefined : nextExport);
      assert.ok(
        body.includes("requireManager(") || body.includes("assertCanDeleteTasks("),
        `${actionName} yetki kontrolünü kendi gövdesinde yapmıyor.`,
      );
    }
  });
});
