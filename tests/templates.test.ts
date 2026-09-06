// Görev şablonları ve tekrar eden görevler. İkisi de "sessizce yanlış" olmaya
// müsait: tarih kayması bir gün şaşabilir, tekrar mantığı sonsuz döngüye
// girebilir ya da hiç tetiklenmeyebilir.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-templates-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");
const {
  addTemplateItem,
  applyTemplateToContent,
  createTemplate,
  listTemplates,
  listTemplatesForContentType,
  listTemplateItems,
  shiftDate,
} = await import("@/lib/repositories/templates");
const { createNextOccurrence, getTask, listTasksByContent } = await import(
  "@/lib/repositories/tasks"
);

const BRAND_ID = "test-marka";
const CONTENT_ID = "test-icerik";

before(() => {
  const db = getDb();
  db.prepare("INSERT INTO brands (id, name, cluster) VALUES (?,?,?)").run(
    BRAND_ID, "Test Marka", "tek",
  );
  db.prepare("INSERT INTO people (id, name) VALUES (?,?)").run("ekin", "Ekin");
  db.prepare(
    "INSERT INTO content_items (id, brand_id, title, type, target_date) VALUES (?,?,?,?,?)",
  ).run(CONTENT_ID, BRAND_ID, "Ağustos Reel", "Reel", "2026-08-10");
});

after(() => {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(TMP_DB + suffix, { force: true });
  }
});

describe("varsayılan şablonlar", () => {
  it("ilk açılışta tohumlanıyor ve satırları dolu", () => {
    const templates = listTemplates();
    const reel = templates.find((t) => t.id === "reel-akisi");
    assert.ok(reel, "Reel akışı şablonu tohumlanmalı");
    assert.equal(reel.content_type, "Reel");
    assert.equal(listTemplateItems("reel-akisi").length, 5);
  });

  it("içerik türüne özel listede genel ve eşleşen şablonları döndürür", () => {
    createTemplate({ name: "Her içerik", contentType: null });
    createTemplate({ name: "Yalnız Post", contentType: "Post" });
    const reelTemplates = listTemplatesForContentType("Reel");
    const reelNames = reelTemplates.map((template) => template.name);
    assert.ok(reelNames.includes("Her içerik"));
    assert.ok(reelTemplates.some((template) => template.id === "reel-akisi"));
    assert.ok(!reelNames.includes("Yalnız Post"));
  });
});

describe("şablon ürün bağlantıları", () => {
  it("yönetim rotasını, görevler girişini ve iki uygulama yüzeyini bağlı tutar", () => {
    const templatesPage = fs.readFileSync(path.join(process.cwd(), "app/templates/page.tsx"), "utf8");
    const tasksPage = fs.readFileSync(path.join(process.cwd(), "app/tasks/page.tsx"), "utf8");
    const contentPage = fs.readFileSync(path.join(process.cwd(), "app/brands/[brandId]/content/[contentId]/page.tsx"), "utf8");
    const brandPage = fs.readFileSync(path.join(process.cwd(), "app/brands/[brandId]/page.tsx"), "utf8");
    const newContent = fs.readFileSync(path.join(process.cwd(), "components/NewContentForm.tsx"), "utf8");
    const applyForm = fs.readFileSync(path.join(process.cwd(), "components/ApplyTemplateForm.tsx"), "utf8");

    assert.doesNotMatch(templatesPage, /redirect\("\/tasks"\)/);
    assert.match(templatesPage, /listTemplatesWithItems/);
    assert.match(templatesPage, /<TemplateManager/);
    assert.match(tasksPage, /href="\/templates"/);
    assert.match(contentPage, /<ApplyTemplateForm/);
    assert.match(contentPage, /listTemplatesForContentType/);
    assert.match(brandPage, /templates=\{templates\}/);
    assert.match(newContent, /name="templateId"/);
    assert.match(newContent, /required=\{Boolean\(templateId\)\}/);
    assert.match(applyForm, /hasTargetDate/);
  });

  it("boş gün kaymasını teslim günü olarak anlatır ve tarihsiz şablon görevi vaat etmez", () => {
    const manager = fs.readFileSync(path.join(process.cwd(), "components/TemplateManager.tsx"), "utf8");
    const actions = fs.readFileSync(path.join(process.cwd(), "lib/actions/templates.ts"), "utf8");
    assert.match(manager, /Boş bırakılırsa teslim günü/);
    assert.doesNotMatch(manager, /tarihsiz açılır/);
    assert.match(actions, /let dueOffsetDays = 0/);
  });
});

describe("shiftDate", () => {
  it("negatif ofset teslimden önceye alıyor", () => {
    assert.equal(shiftDate("2026-08-10", -3), "2026-08-07");
  });

  it("ay sınırını doğru geçiyor", () => {
    assert.equal(shiftDate("2026-08-01", -1), "2026-07-31");
    assert.equal(shiftDate("2026-07-31", 1), "2026-08-01");
  });

  it("0 = teslim günü", () => {
    assert.equal(shiftDate("2026-08-10", 0), "2026-08-10");
  });

  it("ofset yoksa ya da içeriğin tarihi yoksa tarihsiz", () => {
    assert.equal(shiftDate("2026-08-10", null), null);
    assert.equal(shiftDate(null, -3), null);
  });
});

describe("applyTemplateToContent", () => {
  it("şablondaki her satır için görev açıyor, tarihleri kaydırıyor", () => {
    const count = applyTemplateToContent({
      templateId: "reel-akisi",
      contentItemId: CONTENT_ID,
      defaultAssigneeId: "ekin",
    });
    assert.equal(count, 5);

    const tasks = listTasksByContent(CONTENT_ID);
    assert.equal(tasks.length, 5);

    // İçeriğin hedef tarihi 2026-08-10; "Çekim" satırının ofseti -6.
    const cekim = tasks.find((t) => t.title === "Çekim");
    assert.ok(cekim);
    assert.equal(cekim.due_date, "2026-08-04");
    assert.equal(cekim.priority, "Yuksek");
    assert.equal(cekim.assignee_id, "ekin", "satırda atanan yoksa varsayılan kişi");
    assert.equal(cekim.status, "Beklemede");
  });

  it("içeriğin hedef tarihi yoksa şablonu uygulamayı reddediyor", () => {
    const db = getDb();
    db.prepare(
      "INSERT INTO content_items (id, brand_id, title, type) VALUES (?,?,?,?)",
    ).run("tarihsiz-icerik", BRAND_ID, "Tarihsiz", "Reel");

    assert.throws(() => applyTemplateToContent({
      templateId: "reel-akisi",
      contentItemId: "tarihsiz-icerik",
      defaultAssigneeId: null,
    }), /hedef tarihini belirleyin/);
    assert.equal(listTasksByContent("tarihsiz-icerik").length, 0);
  });

  it("boş şablon uygulanınca hiç görev açmıyor", () => {
    const id = createTemplate({ name: "Boş", contentType: null });
    const count = applyTemplateToContent({
      templateId: id,
      contentItemId: CONTENT_ID,
      defaultAssigneeId: null,
    });
    assert.equal(count, 0);
  });

  it("satırdaki atanan, varsayılan kişiyi eziyor", () => {
    const templateId = createTemplate({ name: "Atamalı", contentType: null });
    addTemplateItem({
      templateId,
      title: "Sabit kişiye",
      priority: "Normal",
      dueOffsetDays: null,
    });
    getDb()
      .prepare("UPDATE task_template_items SET assignee_id = ? WHERE template_id = ?")
      .run("ekin", templateId);

    const db = getDb();
    db.prepare(
      "INSERT INTO content_items (id, brand_id, title, type, target_date) VALUES (?,?,?,?,?)",
    ).run("atama-icerik", BRAND_ID, "Atama", "Reel", "2026-08-10");

    applyTemplateToContent({
      templateId,
      contentItemId: "atama-icerik",
      defaultAssigneeId: null,
    });
    const [task] = listTasksByContent("atama-icerik");
    assert.equal(task.assignee_id, "ekin");
    assert.equal(task.due_date, "2026-08-10", "eski boş ofset teslim gününe düşmeli");
  });
});

describe("tekrar eden görev", () => {
  it("bir sonraki örnek, eski teslim tarihine göre kayıyor (bugüne göre değil)", () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO tasks (id, content_item_id, title, status, priority, assignee_id, due_date, notes, repeat_days)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    ).run(
      "haftalik", CONTENT_ID, "Sabah tezgah çekimi", "Yayinlandi", "Normal",
      "ekin", "2026-07-20", "Her hafta aynı saat", 7,
    );

    const original = getTask("haftalik")!;
    // Görev geç tamamlandı: bugün 2026-08-01 ama teslim 2026-07-20'ydi.
    const nextId = createNextOccurrence(original, "2026-08-01");
    const next = getTask(nextId)!;

    assert.equal(next.due_date, "2026-07-27", "takvim kaymamalı: 20 + 7");
    assert.equal(next.title, original.title);
    assert.equal(next.assignee_id, "ekin");
    assert.equal(next.notes, null); // Notes belong to the completed occurrence.
    assert.equal(next.repeat_days, 7, "tekrar devretmeli");
    assert.equal(next.status, "Beklemede", "yeni örnek açık başlamalı (döngü yok)");
  });

  it("eski tarihsiz tekrar için yeni görev açmayı reddediyor", () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO tasks (id, content_item_id, title, status, repeat_days)
       VALUES (?,?,?,?,?)`,
    ).run("tarihsiz-tekrar", CONTENT_ID, "Tarihsiz tekrar", "Yayinlandi", 30);

    assert.throws(() => createNextOccurrence(getTask("tarihsiz-tekrar")!, "2026-08-01"), /önce teslim tarihi/);
  });
});
