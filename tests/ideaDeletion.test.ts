// Fikir silme: arşivlemeden AYRI bir işlem. Yönetici her fikri, sahibi kendi
// fikrini silebilir; bir göreve bağlanmış fikir hiç silinemez (arşivlenebilir).
// Silinen başlık ve kimin sildiği `idea_deletions`'ta kalır.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-idea-delete-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");
const { deleteIdea, getIdea, listIdeaDeletions, setIdeaArchived } =
  await import("@/lib/repositories/ideas");
const { canDeleteIdea } = await import("@/lib/ideas");

function resetDb(): void {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(TMP_DB + suffix, { force: true });
}

function seed(): void {
  const db = getDb();
  db.prepare("INSERT INTO people (id, name, is_manager) VALUES ('yonetici','Yönetici',1)").run();
  db.prepare("INSERT INTO people (id, name, is_manager) VALUES ('sahip','Sahip',0)").run();
  db.prepare("INSERT INTO people (id, name, is_manager) VALUES ('baska','Başka',0)").run();
  db.prepare("INSERT INTO brands (id, name, cluster) VALUES ('b1','Marka','tek')").run();
  db.prepare("INSERT INTO content_items (id, brand_id, title, type) VALUES ('c1','b1','İçerik','Post')").run();
  db.prepare("INSERT INTO tasks (id, content_item_id, title) VALUES ('t1','c1','Görev')").run();
  db.prepare(
    `INSERT INTO ideas (id, scope_type, brand_id, category, title, body, created_by_id, created_by_name)
     VALUES ('i1','brand','b1','Icerik','Serbest fikir','gövde','sahip','Sahip')`,
  ).run();
  db.prepare(
    `INSERT INTO ideas (id, scope_type, brand_id, category, title, body, created_by_id, created_by_name, linked_task_id)
     VALUES ('i2','brand','b1','Icerik','Hayata geçmiş fikir','gövde','sahip','Sahip','t1')`,
  ).run();
}

beforeEach(() => { resetDb(); seed(); });
after(resetDb);

describe("fikir silme yetkisi", () => {
  const manager = { id: "yonetici", is_manager: 1 };
  const owner = { id: "sahip", is_manager: 0 };
  const other = { id: "baska", is_manager: 0 };
  const idea = { created_by_id: "sahip", linked_task_id: null };

  it("yönetici tüm fikirleri, sahibi kendi fikrini silebilir", () => {
    assert.equal(canDeleteIdea(manager, idea), true);
    assert.equal(canDeleteIdea(owner, idea), true);
  });

  it("başkasının fikrini silemez", () => {
    assert.equal(canDeleteIdea(other, idea), false);
  });

  it("göreve bağlı fikri yönetici de silemez", () => {
    assert.equal(canDeleteIdea(manager, { created_by_id: "sahip", linked_task_id: "t1" }), false);
  });

  it("oturum yoksa silemez", () => {
    assert.equal(canDeleteIdea(null, idea), false);
  });
});

describe("deleteIdea", () => {
  it("fikri kaldırıyor ve silme geçmişine başlık + kişi yazıyor", () => {
    const result = deleteIdea("i1", { id: "yonetici", name: "Yönetici" });
    assert.deepEqual(result, { deleted: true });
    assert.equal(getIdea("i1"), undefined);

    const history = listIdeaDeletions();
    assert.equal(history.length, 1);
    assert.equal(history[0].title, "Serbest fikir");
    assert.equal(history[0].actor_name, "Yönetici");
    assert.equal(history[0].idea_id, "i1");
  });

  it("göreve bağlı fikri silmiyor ve bağlı görevi bırakmıyor", () => {
    const result = deleteIdea("i2", { id: "yonetici", name: "Yönetici" });
    assert.deepEqual(result, { deleted: false, reason: "linked" });
    assert.ok(getIdea("i2"));
    assert.ok(getDb().prepare("SELECT 1 FROM tasks WHERE id = 't1'").get());
    assert.equal(listIdeaDeletions().length, 0);
  });

  it("arşivleme silme değildir: kayıt durmaya devam ediyor", () => {
    setIdeaArchived("i1", true);
    const idea = getIdea("i1");
    assert.ok(idea);
    assert.ok(idea.archived_at);
    assert.equal(listIdeaDeletions().length, 0);
  });

  it("olmayan fikirde sessizce 'missing' dönüyor", () => {
    assert.deepEqual(deleteIdea("yok", { id: "yonetici", name: "Yönetici" }), {
      deleted: false,
      reason: "missing",
    });
  });
});
