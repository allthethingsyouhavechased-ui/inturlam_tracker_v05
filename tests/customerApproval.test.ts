// Ekip/müşteri onay akışı. Hedef sıra:
// Beklemede → DevamEdiyor → İncelemede (Ekip) → Onaylandı (Ekip)
// → İncelemede (Müşteri) → Onaylandı (Müşteri) → Yayınlandı.
// "Revizede" bu hattın dışında, açık revize turu olan iş için ayrı bir kova.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-customer-approval-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");
const { changeTaskStatuses, TaskTransitionError } = await import("@/lib/taskLifecycle");
const { createTaskDelivery, decideTaskDelivery, listTaskDeliveries } =
  await import("@/lib/repositories/deliveries");
const { recordCustomerApproval, listTaskCustomerApprovals } =
  await import("@/lib/repositories/customerApprovals");
const { createTask, getTask, setTaskCustomerApprovalRequirement } =
  await import("@/lib/repositories/tasks");

function resetDb(): void {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(TMP_DB + suffix, { force: true });
}

/** Müşteri onayı varsayılanı AÇIK bir marka ve o markada bir görev. */
function seed(customerDefault = 1): string {
  const db = getDb();
  db.prepare(
    "INSERT INTO brands (id, name, cluster, customer_approval_default) VALUES ('b1','Marka','tek',?)",
  ).run(customerDefault);
  db.prepare("INSERT INTO people (id, name, is_manager) VALUES ('mgr','Yönetici',1)").run();
  db.prepare("INSERT INTO accounts (id, kind, person_id, active) VALUES ('team:mgr','team','mgr',1)").run();
  db.prepare("INSERT INTO content_items (id, brand_id, title, type) VALUES ('c1','b1','İçerik','Post')").run();
  return createTask({
    contentItemId: "c1",
    title: "Kapak görseli",
    assigneeId: null,
    dueDate: "2026-09-20",
  });
}

function submitDelivery(taskId: string): string {
  return createTaskDelivery({
    taskId,
    note: "V teslim",
    externalUrl: null,
    guestVisible: false,
    submittedByAccountId: "team:mgr",
    submittedByName: "Yönetici",
    submittedByPersonId: "mgr",
  }).id;
}

function approveDelivery(deliveryId: string): void {
  decideTaskDelivery({
    deliveryId,
    decision: "Onaylandi",
    actorKind: "team",
    actorAccountId: "team:mgr",
    actorName: "Yönetici",
    actorPersonId: "mgr",
    decisionNote: null,
    revisionReason: null,
    revisionTargetMinutes: null,
  });
}

beforeEach(resetDb);
after(resetDb);

describe("müşteri onayı gerekliliği", () => {
  it("marka varsayılanını göreve AÇILIRKEN kopyalıyor", () => {
    const taskId = seed(1);
    assert.equal(getTask(taskId)?.customer_approval_required, 1);
  });

  it("marka ayarının sonradan değişmesi açılmış görevi etkilemiyor", () => {
    const taskId = seed(1);
    getDb().prepare("UPDATE brands SET customer_approval_default = 0 WHERE id = 'b1'").run();
    assert.equal(getTask(taskId)?.customer_approval_required, 1);
  });

  it("görev özelinde gerekçeli istisna veriliyor, marka ayarı değişmiyor", () => {
    const taskId = seed(1);
    assert.equal(setTaskCustomerApprovalRequirement(taskId, false, "Ajans içi deneme işi", "mgr"), true);
    const task = getTask(taskId);
    assert.equal(task?.customer_approval_required, 0);
    assert.equal(task?.customer_approval_exception_note, "Ajans içi deneme işi");
    const brand = getDb().prepare("SELECT customer_approval_default AS d FROM brands WHERE id='b1'").get() as { d: number };
    assert.equal(brand.d, 1);
  });
});

describe("onay aşamaları", () => {
  it("müşteri onayı gerekiyorsa ekip onayından sonra yayına geçilemiyor", () => {
    const taskId = seed(1);
    approveDelivery(submitDelivery(taskId));
    assert.equal(getTask(taskId)?.status, "Onaylandi");
    assert.throws(
      () => changeTaskStatuses([taskId], "Yayinlandi", "mgr"),
      (error: unknown) => error instanceof TaskTransitionError
        && /müşteri onayı olmadan yayınlanamaz/.test((error as Error).message),
    );
  });

  it("müşteri onayı gerekmiyorsa ekip onayından sonra doğrudan yayınlanıyor", () => {
    const taskId = seed(0);
    approveDelivery(submitDelivery(taskId));
    changeTaskStatuses([taskId], "Yayinlandi", "mgr");
    assert.equal(getTask(taskId)?.status, "Yayinlandi");
  });

  it("kayıt olmadan 'Onaylandı (Müşteri)' işaretlenemiyor", () => {
    const taskId = seed(1);
    approveDelivery(submitDelivery(taskId));
    assert.throws(
      () => changeTaskStatuses([taskId], "MusteriOnayladi", "mgr"),
      /Önce müşteri onayını kaydedin/,
    );
  });

  it("onay kaydı sonrası müşteri aşaması ve yayın açılıyor", () => {
    const taskId = seed(1);
    approveDelivery(submitDelivery(taskId));
    changeTaskStatuses([taskId], "MusteriIncelemede", "mgr");
    assert.equal(getTask(taskId)?.status, "MusteriIncelemede");

    const approval = recordCustomerApproval({
      taskId,
      customerName: "Ayşe Hanım",
      channel: "Toplanti",
      referenceUrl: null,
      note: null,
      approvedAt: null,
      recordedById: "mgr",
      recordedByName: "Yönetici",
    });
    // Onayı VEREN müşteri ile KAYDEDEN ekip üyesi ayrı alanlarda.
    assert.equal(approval.customer_name, "Ayşe Hanım");
    assert.equal(approval.recorded_by_name, "Yönetici");
    assert.equal(approval.delivery_version, 1);

    changeTaskStatuses([taskId], "MusteriOnayladi", "mgr");
    changeTaskStatuses([taskId], "Yayinlandi", "mgr");
    assert.equal(getTask(taskId)?.status, "Yayinlandi");
  });

  it("müşteri onayı gerekmeyen işte müşteri aşaması seçilemiyor", () => {
    const taskId = seed(0);
    approveDelivery(submitDelivery(taskId));
    assert.throws(
      () => changeTaskStatuses([taskId], "MusteriIncelemede", "mgr"),
      /müşteri onayı gerekmiyor/,
    );
  });
});

describe("yeni teslim eski onayı geçersiz kılar", () => {
  it("V2 gelince V1'in müşteri onayı düşüyor ve iş ekip incelemesine dönüyor", () => {
    const taskId = seed(1);
    approveDelivery(submitDelivery(taskId));
    recordCustomerApproval({
      taskId,
      customerName: "Ayşe Hanım",
      channel: "WhatsApp",
      referenceUrl: null,
      note: null,
      approvedAt: null,
      recordedById: "mgr",
      recordedByName: "Yönetici",
    });
    changeTaskStatuses([taskId], "MusteriOnayladi", "mgr");

    submitDelivery(taskId);
    assert.equal(getTask(taskId)?.status, "Incelemede");
    const approvals = listTaskCustomerApprovals(taskId);
    assert.equal(approvals.length, 1, "kayıt silinmiyor, damgalanıyor");
    assert.ok(approvals[0].invalidated_at);

    // Yeni sürüm ekipçe onaylansa bile müşteri onayı yeniden gerekiyor.
    approveDelivery(listTaskDeliveries(taskId)[0].id);
    assert.throws(() => changeTaskStatuses([taskId], "Yayinlandi", "mgr"), /müşteri onayı olmadan/);
  });

  it("ekip onayı olmadan müşteri onayı kaydedilemiyor", () => {
    const taskId = seed(1);
    submitDelivery(taskId);
    assert.throws(
      () => recordCustomerApproval({
        taskId,
        customerName: "Ayşe Hanım",
        channel: "Telefon",
        referenceUrl: null,
        note: null,
        approvedAt: null,
        recordedById: "mgr",
        recordedByName: "Yönetici",
      }),
      /teslim ekipçe onaylanmalı/,
    );
  });

  it("aynı teslim sürümü için ikinci onay kaydı açılmıyor", () => {
    const taskId = seed(1);
    approveDelivery(submitDelivery(taskId));
    const input = {
      taskId,
      customerName: "Ayşe Hanım",
      channel: "Eposta" as const,
      referenceUrl: null,
      note: null,
      approvedAt: null,
      recordedById: "mgr",
      recordedByName: "Yönetici",
    };
    recordCustomerApproval(input);
    assert.throws(() => recordCustomerApproval(input), /zaten kayıtlı/);
  });
});

describe("Revizede durumu", () => {
  it("revize kararı işi kendi sütununa taşıyor", () => {
    const taskId = seed(1);
    const deliveryId = submitDelivery(taskId);
    decideTaskDelivery({
      deliveryId,
      decision: "RevizeIstendi",
      actorKind: "team",
      actorAccountId: "team:mgr",
      actorName: "Yönetici",
      actorPersonId: "mgr",
      decisionNote: "Metin kısalsın.",
      revisionReason: "Metin",
      revisionTargetMinutes: 120,
    });
    assert.equal(getTask(taskId)?.status, "Revizede");
  });

  it("açık revize turu yokken Revizede durumu elle seçilemiyor", () => {
    const taskId = seed(1);
    assert.throws(
      () => changeTaskStatuses([taskId], "Revizede", "mgr"),
      /açık bir revize turu gerekli/,
    );
  });
});
