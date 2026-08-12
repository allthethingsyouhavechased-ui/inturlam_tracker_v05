import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-v03-progress-repo-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;
const { getDb } = await import("@/lib/db/client");
const { getBrandMonthlyProgress, getPersonMonthlyProgress } = await import("@/lib/repositories/progress");

function resetDb() { globalThis.__inturlamDb?.close(); globalThis.__inturlamDb = undefined; for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(TMP_DB + suffix, { force: true }); }
beforeEach(resetDb); after(resetDb);

describe("v03 ilerleme aylık kapsamı", () => {
  it("due_date ay sınırını kullanır, arşivliyi tutar ve planlanmamış guest görevini dışarıda bırakır", () => {
    const db = getDb();
    db.prepare("INSERT INTO brands (id,name,cluster) VALUES ('b1','Bir','tek')").run();
    db.prepare("INSERT INTO people (id,name) VALUES ('p1','Ada')").run();
    db.prepare("INSERT INTO content_items (id,brand_id,title,type) VALUES ('c1','b1','İş','Diger')").run();
    const insert = db.prepare(`INSERT INTO tasks (id,content_item_id,title,status,assignee_id,due_date,weight_points,origin,archived_at,requested_date) VALUES (?,?,?,?,?,?,?,?,?,?)`);
    insert.run("aug-open", "c1", "Ağustos", "DevamEdiyor", "p1", "2026-08-31", 4, "team", null, null);
    insert.run("aug-archived", "c1", "Arşiv", "Yayinlandi", "p1", "2026-08-01", 6, "team", "2026-08-20", null);
    insert.run("sep", "c1", "Eylül", "Yayinlandi", "p1", "2026-09-01", 100, "team", null, null);
    insert.run("guest-unplanned", "c1", "Planlanacak", "Beklemede", null, null, 100, "guest", null, "2026-08-15");
    const brand = getBrandMonthlyProgress("b1", "2026-08");
    assert.equal(brand.task_count, 2);
    assert.equal(brand.weighted_total, 10);
    assert.equal(brand.percent, 70);
    assert.equal(getPersonMonthlyProgress("p1", "2026-08").percent, 70);
  });
});
