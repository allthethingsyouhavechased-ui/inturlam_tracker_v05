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
  addClientRequestAttachment,
  approveClientRequest,
  countOpenClientRequests,
  createClientRequest,
  deleteClientRequest,
  getClientRequest,
  getClientRequestByTask,
  listClientRequestComments,
  listClientRequestAttachments,
  listClientRequestsForPerson,
  rejectClientRequest,
  sweepArchivableClientRequests,
  updateClientRequestDetails,
  updateClientRequestReview,
} = await import("@/lib/repositories/clientRequests");
const { canReviewClientRequests } = await import("@/lib/requestAccess");
const { setRequestReviewer } = await import("@/lib/repositories/requestReviewers");
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
  insertPerson.run("defne", "Defne", "social", 0);
  insertPerson.run("melis", "Melis", "social", 0);
  // Yönetici olmayan ama talep değerlendirme yetkisi verilmiş kişiler.
  // (Canlıda bu satırları migration 030 eski sabit listeden taşıyor.)
  const grantReviewer = db.prepare("INSERT INTO client_request_reviewers (person_id) VALUES (?)");
  grantReviewer.run("cansu");
  grantReviewer.run("defne");
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
  // Yetki artık sabit liste değil, yönetilebilir tablo (client_request_reviewers).
  // Sıla, Defne ve Cansu'nun mevcut hakları migration 030 ile taşındı;
  // yöneticiler tabloda olmasa da değerlendirebiliyor.
  it("yöneticilere ve yetki verilmiş kişilere erişim veriyor", () => {
    assert.equal(canReviewClientRequests({ id: "yunus", is_manager: 1 }), true);
    assert.equal(canReviewClientRequests({ id: "sila", is_manager: 1 }), true);
    assert.equal(canReviewClientRequests({ id: "erhan", is_manager: 1 }), true);
    assert.equal(canReviewClientRequests({ id: "cansu", department: "social" }), true);
    assert.equal(canReviewClientRequests({ id: "defne", department: "social" }), true);
    assert.equal(canReviewClientRequests({ id: "ozgur", department: "management" }), false);
    assert.equal(canReviewClientRequests({ id: "ekin", department: "design" }), false);
    assert.equal(canReviewClientRequests({ id: "melis", department: "social" }), false);
    assert.equal(canReviewClientRequests(null), false);
  });

  it("yönetici yetkiyi verip geri alabiliyor, başkasınınki etkilenmiyor", () => {
    assert.equal(canReviewClientRequests({ id: "melis" }), false);
    assert.equal(setRequestReviewer("melis", true, "yunus"), true);
    assert.equal(canReviewClientRequests({ id: "melis" }), true);
    assert.equal(canReviewClientRequests({ id: "cansu" }), true, "diğerinin hakkı korunmalı");
    assert.equal(setRequestReviewer("melis", false, "yunus"), true);
    assert.equal(canReviewClientRequests({ id: "melis" }), false);
    assert.equal(canReviewClientRequests({ id: "cansu" }), true);
  });

  it("yetkili listeye bütün kuyruğu döndürür", () => {
    createFixture("cansu");
    createFixture("ekin");
    const socialCanReview = canReviewClientRequests({ id: "cansu", department: "social" });
    assert.equal(listClientRequestsForPerson("cansu", socialCanReview).length, 2);
    assert.equal(listClientRequestsForPerson("defne", true).length, 2);
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

  it("açık talebin briefini düzenler ve departman değişince eski atamayı temizler", () => {
    const id = createFixture();
    updateClientRequestReview({
      id,
      reviewerId: "sila",
      department: "design",
      assigneeId: "ekin",
      priority: "Normal",
      dueDate: null,
    });
    updateClientRequestDetails({
      id,
      brandId: "brand-1",
      title: "Güncel brief",
      description: "Yeni müşteri notu",
      requestedByName: null,
      source: "E-posta",
      referenceUrl: null,
      department: "video",
      contentType: "Video",
      dueDate: "2026-08-22",
    });

    const request = getClientRequest(id);
    assert.equal(request?.title, "Güncel brief");
    assert.equal(request?.department, "video");
    assert.equal(request?.assignee_id, null);
  });

  it("reddedilmiş talep düzenlenince yeniden beklemeye alınır", () => {
    const requestId = createFixture();
    rejectClientRequest({ id: requestId, reviewerId: "yunus", reason: "Brief eksik." });

    updateClientRequestDetails({
      id: requestId,
      brandId: "brand-1",
      title: "Revize brief",
      description: "Eksikleri tamamlandı.",
      requestedByName: "Müşteri",
      source: "E-posta",
      referenceUrl: null,
      department: "video",
      contentType: "Video",
      dueDate: "2026-08-28",
    });

    const updated = getClientRequest(requestId);
    assert.equal(updated?.status, "Beklemede");
    assert.equal(updated?.reviewed_by_id, null);
    assert.equal(updated?.reviewed_at, null);
    assert.equal(updated?.assignee_id, null);
  });

  it("talep görselini saklar ve onayda göreve ayrı dosya yolu ile taşır", () => {
    const id = createFixture();
    addClientRequestAttachment({
      requestId: id,
      filePath: "/uploads/requests/brief.png",
      originalName: "brief.png",
    });
    const converted = approveClientRequest(
      {
        id,
        reviewerId: "sila",
        department: "design",
        assigneeId: "ekin",
        priority: "Normal",
        dueDate: null,
      },
      [{ filePath: "/uploads/tasks/brief-copy.png", originalName: "brief.png" }],
    );

    assert.equal(listClientRequestAttachments(id).length, 1);
    const taskAttachment = getDb()
      .prepare("SELECT file_path, original_name FROM task_attachments WHERE task_id = ?")
      .get(converted.taskId) as { file_path: string; original_name: string };
    assert.deepEqual({ ...taskAttachment }, {
      file_path: "/uploads/tasks/brief-copy.png",
      original_name: "brief.png",
    });
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

  it("kararı yedi günü geçen onaylı ve reddedilmiş talepleri arşivler", () => {
    const approvedId = createFixture();
    approveClientRequest({
      id: approvedId,
      reviewerId: "sila",
      department: "design",
      assigneeId: "ekin",
      priority: "Normal",
      dueDate: null,
    });
    const rejectedId = createFixture();
    rejectClientRequest({ id: rejectedId, reviewerId: "erhan", reason: "Uygun değil." });
    getDb()
      .prepare("UPDATE client_requests SET reviewed_at = datetime('now', '-8 days') WHERE id IN (?, ?)")
      .run(approvedId, rejectedId);

    assert.equal(sweepArchivableClientRequests(), 2);
    assert.equal(listClientRequestsForPerson("yunus", true).length, 0);
    assert.equal(listClientRequestsForPerson("yunus", true, true).length, 2);
  });

  it("göreve dönüşmemiş talebi siler ama dönüştürülmüş kaydı korur", () => {
    const openId = createFixture();
    deleteClientRequest(openId);
    assert.equal(getClientRequest(openId), undefined);

    const approvedId = createFixture();
    approveClientRequest({
      id: approvedId,
      reviewerId: "sila",
      department: "design",
      assigneeId: "ekin",
      priority: "Normal",
      dueDate: null,
    });
    assert.throws(() => deleteClientRequest(approvedId), /göreve dönüştürülmüş/i);
  });
});
