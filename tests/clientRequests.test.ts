import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-client-requests-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");
const {
  addClientRequestComment,
  approveClientRequest,
  countOpenClientRequests,
  createClientRequest,
  getClientRequest,
  getClientRequestByTask,
  listClientRequestComments,
  listClientRequestsForPerson,
  rejectClientRequest,
  updateClientRequestReview,
} = await import("@/lib/repositories/clientRequests");
const { canReviewClientRequests } = await import("@/lib/requestAccess");
const { listAllTasks } = await import("@/lib/repositories/tasks");

function resetDb(): void {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(TMP_DB + suffix, { force: true });
  }
}

function seedBase(): void {
  const db = getDb();
  db.prepare("INSERT INTO brands (id, name, cluster) VALUES (?, ?, ?)").run(
    "brand-1",
    "Test Marka",
    "test",
  );
  const insertPerson = db.prepare(
    "INSERT INTO people (id, name, department, is_manager) VALUES (?, ?, ?, ?)",
  );
  insertPerson.run("yunus", "Yunus Emre", "video", 1);
  insertPerson.run("sila", "Sıla", "design", 1);
  insertPerson.run("erhan", "Erhan", "video", 1);
  insertPerson.run("ekin", "Ekin", "design", 0);
  insertPerson.run("cansu", "Cansu", "social", 0);
}

function createFixture(createdById = "cansu"): string {
  return createClientRequest({
    brandId: "brand-1",
    title: "Ağustos kampanya görselleri",
    description: "Müşteri üç farklı ölçüde ana görsel istiyor.",
    requestedByName: "Ayşe Hanım",
    source: "WhatsApp",
    referenceUrl: "https://example.com/brief",
    department: "design",
    contentType: "Kampanya",
    dueDate: "2026-08-18",
    createdById,
  });
}

beforeEach(() => {
  resetDb();
  seedBase();
});

after(resetDb);

describe("müşteri talebi erişimi", () => {
  it("tanımlı departman sorumluları ile sosyal medya ekibine değerlendirme yetkisi verir", () => {
    assert.equal(canReviewClientRequests({ id: "yunus" }), true);
    assert.equal(canReviewClientRequests({ id: "sila" }), true);
    assert.equal(canReviewClientRequests({ id: "erhan" }), true);
    assert.equal(canReviewClientRequests({ id: "cansu", department: "social" }), true);
    assert.equal(canReviewClientRequests({ id: "ozgur", department: "management" }), false);
    assert.equal(canReviewClientRequests({ id: "ekin", department: "design" }), false);
    assert.equal(canReviewClientRequests(null), false);
  });

  it("normal ekip üyesine kendi taleplerini, sosyal ekibe ve sorumluya bütün kuyruğu döndürür", () => {
    createFixture("cansu");
    const designRequestId = createFixture("ekin");

    assert.deepEqual(
      listClientRequestsForPerson("ekin", false).map((request) => request.id),
      [designRequestId],
    );
    const socialCanReview = canReviewClientRequests({ id: "cansu", department: "social" });
    assert.equal(listClientRequestsForPerson("cansu", socialCanReview).length, 2);
    assert.equal(listClientRequestsForPerson("yunus", true).length, 2);
    assert.equal(countOpenClientRequests(), 2);
  });
});

describe("müşteri talebi değerlendirme akışı", () => {
  it("talebi hedef departmandaki kişiye atayıp incelemeye alır", () => {
    const id = createFixture();
    updateClientRequestReview({
      id,
      reviewerId: "sila",
      department: "design",
      assigneeId: "ekin",
      priority: "Yuksek",
      dueDate: "2026-08-20",
    });

    const request = getClientRequest(id);
    assert.equal(request?.status, "Incelemede");
    assert.equal(request?.assignee_id, "ekin");
    assert.equal(request?.priority, "Yuksek");
    assert.equal(request?.reviewed_by_id, "sila");
  });

  it("başka departmandaki kişiye atamayı reddeder", () => {
    const id = createFixture();
    assert.throws(
      () =>
        updateClientRequestReview({
          id,
          reviewerId: "sila",
          department: "design",
          assigneeId: "cansu",
          priority: "Normal",
          dueDate: null,
        }),
      /departman/i,
    );
  });

  it("yorumları yazarıyla birlikte kronolojik saklar", () => {
    const id = createFixture();
    addClientRequestComment({ requestId: id, authorId: "sila", body: "Logo dosyasını bekliyoruz." });
    addClientRequestComment({ requestId: id, authorId: "yunus", body: "Müşteriden teyit geldi." });

    assert.deepEqual(
      listClientRequestComments(id).map(({ author_name, body }) => ({ author_name, body })),
      [
        { author_name: "Sıla", body: "Logo dosyasını bekliyoruz." },
        { author_name: "Yunus Emre", body: "Müşteriden teyit geldi." },
      ],
    );
  });

  it("onayda içerik ve görevi tek işlemde üretip talebe bağlar", () => {
    const id = createFixture();
    const converted = approveClientRequest({
      id,
      reviewerId: "sila",
      department: "design",
      assigneeId: "ekin",
      priority: "Acil",
      dueDate: "2026-08-18",
    });

    const request = getClientRequest(id);
    const task = getDb()
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(converted.taskId) as { title: string; priority: string; assignee_id: string; notes: string };
    const content = getDb()
      .prepare("SELECT * FROM content_items WHERE id = ?")
      .get(converted.contentItemId) as { type: string; brand_id: string };

    assert.equal(request?.status, "Onaylandi");
    assert.equal(request?.converted_task_id, converted.taskId);
    assert.equal(task.title, "Ağustos kampanya görselleri");
    assert.equal(task.priority, "Acil");
    assert.equal(task.assignee_id, "ekin");
    assert.match(task.notes, /Müşteri üç farklı ölçüde/);
    assert.equal(content.type, "Kampanya");
    assert.equal(content.brand_id, "brand-1");
    assert.equal(getClientRequestByTask(converted.taskId)?.id, id);
    assert.equal(listAllTasks().some((listedTask) => listedTask.id === converted.taskId), true);
  });

  it("aynı talebi ikinci kez göreve dönüştürmez", () => {
    const id = createFixture();
    const input = {
      id,
      reviewerId: "sila",
      department: "design" as const,
      assigneeId: "ekin",
      priority: "Normal" as const,
      dueDate: null,
    };
    approveClientRequest(input);
    assert.throws(() => approveClientRequest(input), /zaten onaylan/i);
    const row = getDb().prepare("SELECT COUNT(*) AS count FROM tasks").get() as { count: number };
    assert.equal(row.count, 1);
  });

  it("reddetme gerekçesini yorum olarak kaydeder", () => {
    const id = createFixture();
    rejectClientRequest({ id, reviewerId: "erhan", reason: "Brief ve teslim tarihi net değil." });
    assert.equal(getClientRequest(id)?.status, "Reddedildi");
    assert.equal(listClientRequestComments(id)[0]?.body, "Brief ve teslim tarihi net değil.");
  });
});
