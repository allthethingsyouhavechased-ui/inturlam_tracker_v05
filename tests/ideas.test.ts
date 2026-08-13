import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-ideas-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");
const { ideaTags, normalizeIdeaSourceUrl, normalizeIdeaTags } = await import("@/lib/ideas");
const {
  createIdea,
  getIdea,
  listIdeas,
  setIdeaArchived,
  updateIdea,
  updateIdeaStatus,
} = await import("@/lib/repositories/ideas");

function resetDb(): void {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(TMP_DB + suffix, { force: true });
}

function seedBase(): void {
  const db = getDb();
  db.prepare("INSERT INTO brands (id, name, cluster) VALUES ('b1', 'Kuzey', 'tek')").run();
  db.prepare("INSERT INTO people (id, name) VALUES ('p1', 'Ayşe')").run();
}

function addIdea(brandId: string | null = "b1"): string {
  return createIdea({
    brandId,
    category: "Icerik",
    status: "Yeni",
    title: "Sessiz ürün videosu",
    body: "Ürünün gündelik seslerini ritim olarak kullanan kısa video.",
    sourceUrl: "https://www.instagram.com/reel/abc/",
    sourcePlatform: "Instagram",
    tagsText: "ürün, ses tasarımı",
    createdById: "p1",
    createdByName: "Ayşe",
  });
}

beforeEach(resetDb);
after(resetDb);

describe("fikir bankası veri sözleşmesi", () => {
  it("marka ve ofis genelindeki fikirleri aynı bankada bağlamını koruyarak saklar", () => {
    seedBase();
    const brandIdeaId = addIdea();
    const officeIdeaId = addIdea(null);

    assert.equal(getIdea(brandIdeaId)?.scope_type, "brand");
    assert.equal(getIdea(brandIdeaId)?.brand_name, "Kuzey");
    assert.equal(getIdea(officeIdeaId)?.scope_type, "office");
    assert.equal(getIdea(officeIdeaId)?.brand_name, null);
    assert.deepEqual(listIdeas().map((idea) => idea.id), [officeIdeaId, brandIdeaId]);
    assert.throws(() => addIdea("missing"), /geçerli bir marka/i);
  });

  it("marka silinse bile snapshot adıyla fikrin bağlamını korur", () => {
    seedBase();
    const ideaId = addIdea();
    getDb().prepare("DELETE FROM brands WHERE id = 'b1'").run();
    const idea = getIdea(ideaId);
    assert.equal(idea?.brand_id, null);
    assert.equal(idea?.scope_type, "brand");
    assert.equal(idea?.brand_name, "Kuzey");
  });

  it("durum, düzenleme ve geri alınabilir arşiv akışını uygular", () => {
    seedBase();
    const ideaId = addIdea();
    updateIdeaStatus(ideaId, "Gelistiriliyor");
    assert.equal(getIdea(ideaId)?.status, "Gelistiriliyor");

    updateIdea({
      id: ideaId,
      brandId: null,
      category: "Ofis",
      status: "Hazir",
      title: "Haftalık ilham saati",
      body: "Cuma günü ekipçe örnek işleri değerlendirme oturumu.",
      sourceUrl: null,
      sourcePlatform: null,
      tagsText: "ekip, ritüel",
    });
    assert.equal(getIdea(ideaId)?.scope_type, "office");
    assert.equal(getIdea(ideaId)?.status, "Hazir");

    setIdeaArchived(ideaId, true);
    assert.equal(listIdeas().length, 0);
    assert.equal(listIdeas(true).length, 1);
    assert.throws(() => updateIdeaStatus(ideaId, "Kullanildi"), /arşivde/i);
    setIdeaArchived(ideaId, false);
    assert.equal(listIdeas().length, 1);
  });
});

describe("fikir kaynağı ve etiket normalizasyonu", () => {
  it("Instagram ve diğer yaygın ilham platformlarını güvenli URL'den tanır", () => {
    assert.equal(normalizeIdeaSourceUrl("https://instagram.com/reel/xyz").platform, "Instagram");
    assert.equal(normalizeIdeaSourceUrl("https://youtu.be/abc").platform, "YouTube");
    assert.equal(normalizeIdeaSourceUrl("https://example.com/article").platform, "Web");
    assert.deepEqual(normalizeIdeaSourceUrl("  "), { url: null, platform: null });
    assert.throws(() => normalizeIdeaSourceUrl("javascript:alert(1)"), /http veya https/i);
  });

  it("etiketleri temizler, Türkçe büyük-küçük harfle tekilleştirir ve sınırlar", () => {
    const normalized = normalizeIdeaTags(" Reels, ürün, REELS, ses  tasarımı ");
    assert.equal(normalized, "Reels, ürün, ses tasarımı");
    assert.deepEqual(ideaTags(normalized), ["Reels", "ürün", "ses tasarımı"]);
    assert.throws(() => normalizeIdeaTags("1,2,3,4,5,6,7,8,9"), /en fazla 8/i);
  });
});
