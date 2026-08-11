// EN KRİTİK TEST. `lib/db/client.ts`'teki migration zinciri, mevcut bir DB'yi
// açarken tabloları yeniden kuruyor. Bir kez, `migrateBrandsTableIfNeeded`'in
// guard'ı yüzünden 15 sütunluk marka tablosunun 10 sütununu silmesine ramak
// kalmıştı (yalnızca 5 sütun kopyalıyor). Bu test tam olarak o senaryoyu
// kilitler: ESKİ şemalı bir DB aç → tek satır, tek sütun kaybolmasın.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, beforeEach, describe, it } from "node:test";

// getDb() DB yolunu MODÜL YÜKLENİRKEN okuyor → import'tan ÖNCE ayarlanmalı.
// Bu yüzden statik import değil, aşağıda dinamik import var.
const TMP_DB = path.join(os.tmpdir(), `inturlam-test-migrations-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");

const SCHEMA_SQL = fs.readFileSync(
  path.join(process.cwd(), "lib", "db", "schema.sql"),
  "utf-8",
);

// Kategoriler `clusters` tablosuna taşınmadan önceki brands tablosu: cluster
// üzerinde CHECK var, 15 sütunun hepsi mevcut. `migrateBrandsDropClusterCheckIfNeeded`
// bunu yeniden kurmalı ve HER sütunu taşımalı.
const OLD_BRANDS_WITH_EMLAK = `
  CREATE TABLE brands (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    cluster    TEXT NOT NULL CHECK (cluster IN ('balik-deniz','kahve-gida','b2b-yapi','hamam','emlak','tek')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    archived   INTEGER NOT NULL DEFAULT 0,
    logo_path          TEXT,
    instagram_handle   TEXT,
    follower_count     INTEGER,
    post_count         INTEGER,
    median_reel_views  TEXT,
    cover_test_verdict TEXT CHECK (cover_test_verdict IN ('Gecti','Kismen','Basarisiz','Sinirda')),
    cover_test_note    TEXT,
    key_finding        TEXT,
    first_action       TEXT,
    tier               TEXT
  )
`;

// Daha da eski hali: 4 kategorili CHECK, ek sütunlar yok.
const OLDEST_BRANDS = `
  CREATE TABLE brands (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    cluster    TEXT NOT NULL CHECK (cluster IN ('balik-deniz','kahve-gida','b2b-yapi','hamam')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    archived   INTEGER NOT NULL DEFAULT 0
  )
`;

interface BrandRow {
  id: string;
  name: string;
  cluster: string;
  sort_order: number;
  archived: number;
  logo_path: string | null;
  instagram_handle: string | null;
  follower_count: number | null;
  post_count: number | null;
  median_reel_views: string | null;
  cover_test_verdict: string | null;
  cover_test_note: string | null;
  key_finding: string | null;
  first_action: string | null;
  tier: string | null;
}

// getDb() bağlantıyı globalThis'te önbelleğe alıyor; her senaryo temiz bir
// dosyayla başlasın diye hem bağlantıyı hem dosyayı sıfırlıyoruz.
function resetDb(): void {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(TMP_DB + suffix, { force: true });
  }
}

// Eski şemalı bir DB üretir: önce eski brands tablosu, sonra schema.sql'in geri
// kalanı (CREATE TABLE IF NOT EXISTS olduğu için brands'e dokunmaz) — gerçek bir
// eski DB'nin birebir hali.
function seedLegacyDb(brandsDdl: string, fill: (db: DatabaseSync) => void): void {
  const db = new DatabaseSync(TMP_DB);
  try {
    db.exec("PRAGMA foreign_keys = ON");
    db.exec(brandsDdl);
    db.exec(SCHEMA_SQL);
    fill(db);
  } finally {
    db.close();
  }
}

after(() => {
  resetDb();
});

beforeEach(() => {
  resetDb();
});

describe("brands migration zinciri", () => {
  it("15 sütunlu eski şemadan geçerken hiçbir veri kaybolmuyor", () => {
    const brand: BrandRow = {
      id: "sihirliolta",
      name: "Sihirli Olta",
      cluster: "balik-deniz",
      sort_order: 30,
      archived: 0,
      logo_path: "/logos/sihirliolta.jpg",
      instagram_handle: "sihirliolta",
      follower_count: 12400,
      post_count: 318,
      median_reel_views: "8.2K",
      cover_test_verdict: "Basarisiz",
      cover_test_note: "Kapakta yüz yok, tipografi küçük.",
      key_finding: "Reel'ler iyi, kapaklar tıklanmıyor.",
      first_action: "Kapak şablonu yeniden tasarlansın.",
      tier: "A",
    };

    seedLegacyDb(OLD_BRANDS_WITH_EMLAK, (db) => {
      db.prepare(
        `INSERT INTO brands (id, name, cluster, sort_order, archived, logo_path,
           instagram_handle, follower_count, post_count, median_reel_views,
           cover_test_verdict, cover_test_note, key_finding, first_action, tier)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        brand.id, brand.name, brand.cluster, brand.sort_order, brand.archived,
        brand.logo_path, brand.instagram_handle, brand.follower_count,
        brand.post_count, brand.median_reel_views, brand.cover_test_verdict,
        brand.cover_test_note, brand.key_finding, brand.first_action, brand.tier,
      );
      // Kategorisi artık listede olmayan bir marka: silinmemeli, `clusters`
      // tablosuna geri doldurulmalı.
      db.prepare("INSERT INTO brands (id, name, cluster) VALUES (?,?,?)").run(
        "ozelmarka", "Özel Marka", "emlak",
      );
      db.prepare("INSERT INTO people (id, name) VALUES (?,?)").run("yunus", "Yunus Emre");
      db.prepare(
        "INSERT INTO content_items (id, brand_id, title, type) VALUES (?,?,?,?)",
      ).run("c1", "sihirliolta", "Ağustos Reel Serisi", "Reel");
      db.prepare(
        "INSERT INTO tasks (id, content_item_id, title, assignee_id) VALUES (?,?,?,?)",
      ).run("t1", "c1", "Kapak görselleri", "yunus");
      db.prepare(
        "INSERT INTO brand_audits (brand_id, body_markdown) VALUES (?,?)",
      ).run("sihirliolta", "# Denetim\n\nUzun metin.");
      db.prepare(
        `INSERT INTO brand_relations (id, brand_id, related_brand_id, relation_type, note)
         VALUES (?,?,?,?,?)`,
      ).run("r1", "sihirliolta", "ozelmarka", "rakip", "Aynı kitleye sesleniyorlar.");
      db.prepare(
        "INSERT INTO comments (id, task_id, author_id, body) VALUES (?,?,?,?)",
      ).run("cm1", "t1", "yunus", "Tipografi en az 90pt olsun.");
    });

    const db = getDb();

    const stored = db.prepare("SELECT * FROM brands WHERE id = ?").get("sihirliolta");
    // Eski 15 sütunun hepsi aynen duruyor; sonradan ALTER ile eklenen
    // `stats_updated_at` boş geliyor (migrateBrandsStatsUpdatedIfNeeded).
    // Bu satır bilerek TÜM satırı karşılaştırıyor: brands'e yeni bir sütun
    // eklenirse test kırılır ve eklenen sütunun rebuild'de düşmediği
    // bilinçli olarak doğrulanmış olur.
    assert.deepEqual(
      { ...(stored as Record<string, unknown>) },
      { ...brand, stats_updated_at: null },
    );

    assert.equal(
      (db.prepare("SELECT COUNT(*) c FROM brands").get() as { c: number }).c,
      2,
      "marka sayısı korunmalı",
    );
    for (const [table, expected] of [
      ["content_items", 1],
      ["tasks", 1],
      ["brand_audits", 1],
      ["brand_relations", 1],
      ["comments", 1],
      ["people", 1],
    ] as const) {
      assert.equal(
        (db.prepare(`SELECT COUNT(*) c FROM ${table}`).get() as { c: number }).c,
        expected,
        `${table} satırları korunmalı`,
      );
    }

    const brandsSql = (
      db
        .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='brands'")
        .get() as { sql: string }
    ).sql;
    assert.ok(
      !/CHECK\s*\(\s*cluster\s+IN/i.test(brandsSql),
      "cluster üzerindeki CHECK kaldırılmış olmalı",
    );

    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), [], "FK bütünlüğü");
    assert.equal(
      (db.prepare("PRAGMA integrity_check").get() as { integrity_check: string })
        .integrity_check,
      "ok",
    );
  });

  it("markaların kategorileri clusters tablosuna tohumlanıyor", () => {
    seedLegacyDb(OLD_BRANDS_WITH_EMLAK, (db) => {
      db.prepare("INSERT INTO brands (id, name, cluster) VALUES (?,?,?)").run(
        "a", "A", "balik-deniz",
      );
    });

    const db = getDb();
    const clusters = db.prepare("SELECT id FROM clusters ORDER BY id").all() as {
      id: string;
    }[];
    const ids = clusters.map((c) => c.id);
    for (const expected of ["balik-deniz", "kahve-gida", "b2b-yapi", "hamam", "emlak", "tek"]) {
      assert.ok(ids.includes(expected), `${expected} kategorisi tohumlanmalı`);
    }

    // Hiçbir marka gruplanamadan kalmamalı: her cluster değerinin karşılığı olmalı.
    const orphans = db
      .prepare("SELECT COUNT(*) c FROM brands WHERE cluster NOT IN (SELECT id FROM clusters)")
      .get() as { c: number };
    assert.equal(orphans.c, 0);
  });

  it("elle eklenmiş bilinmeyen kategori de tohumlanıyor", () => {
    seedLegacyDb(OLD_BRANDS_WITH_EMLAK, (db) => {
      // Eski tabloda CHECK olduğu için bilinmeyen kategoriyi doğrudan yazamayız;
      // önce migration'ın CHECK'i kaldırmasını bekleyip sonra yazıyoruz.
      db.prepare("INSERT INTO brands (id, name, cluster) VALUES (?,?,?)").run(
        "a", "A", "tek",
      );
    });

    const db = getDb();
    db.prepare("UPDATE brands SET cluster = ? WHERE id = ?").run("ozel-kume", "a");

    // Bağlantıyı kapatıp yeniden açınca seedClustersIfNeeded bunu yakalamalı.
    globalThis.__inturlamDb?.close();
    globalThis.__inturlamDb = undefined;

    const reopened = getDb();
    const row = reopened.prepare("SELECT label FROM clusters WHERE id = ?").get("ozel-kume") as
      | { label: string }
      | undefined;
    assert.ok(row, "bilinmeyen kategori clusters'a eklenmeli");
    assert.equal(row.label, "ozel-kume", "etiket olarak id kullanılmalı");
  });

  it("en eski (4 kategorili, 5 sütunlu) şemadan da veri kaybetmeden geçiyor", () => {
    seedLegacyDb(OLDEST_BRANDS, (db) => {
      db.prepare(
        "INSERT INTO brands (id, name, cluster, sort_order, archived) VALUES (?,?,?,?,?)",
      ).run("kahvecihb", "Kahveci Hacıbaba", "kahve-gida", 20, 1);
    });

    const db = getDb();
    const row = db.prepare("SELECT * FROM brands WHERE id = ?").get("kahvecihb") as
      | Record<string, unknown>
      | undefined;
    assert.ok(row);
    assert.equal(row.name, "Kahveci Hacıbaba");
    assert.equal(row.cluster, "kahve-gida");
    assert.equal(row.sort_order, 20);
    assert.equal(row.archived, 1);
    // Yeni sütunlar eklenmiş olmalı (değerleri NULL).
    assert.ok("cover_test_verdict" in row);
    assert.ok("tier" in row);
  });

  it("ikinci kez açmak hiçbir şeyi değiştirmiyor (idempotent)", () => {
    seedLegacyDb(OLD_BRANDS_WITH_EMLAK, (db) => {
      db.prepare("INSERT INTO brands (id, name, cluster) VALUES (?,?,?)").run(
        "a", "A", "hamam",
      );
    });

    const first = getDb();
    const snapshot = {
      brands: first.prepare("SELECT * FROM brands ORDER BY id").all(),
      clusters: first.prepare("SELECT id, label FROM clusters ORDER BY id").all(),
      sql: first
        .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='brands'")
        .get(),
    };

    globalThis.__inturlamDb?.close();
    globalThis.__inturlamDb = undefined;

    const second = getDb();
    assert.deepEqual(second.prepare("SELECT * FROM brands ORDER BY id").all(), snapshot.brands);
    assert.deepEqual(
      second.prepare("SELECT id, label FROM clusters ORDER BY id").all(),
      snapshot.clusters,
    );
    assert.deepEqual(
      second
        .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='brands'")
        .get(),
      snapshot.sql,
    );
  });
});

describe("people profil migration'ı", () => {
  it("eski kişi tablosuna profil alanlarını veri kaybetmeden ekliyor", () => {
    const legacy = new DatabaseSync(TMP_DB);
    legacy.exec(`
      CREATE TABLE people (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      );
      INSERT INTO people (id, name, active) VALUES ('p1', 'Ayşe', 1);
    `);
    legacy.close();

    const db = getDb();
    const row = db.prepare("SELECT * FROM people WHERE id = 'p1'").get() as
      | Record<string, unknown>
      | undefined;

    assert.deepEqual({ ...row }, {
      id: "p1",
      name: "Ayşe",
      active: 1,
      title: null,
      bio: null,
      avatar_path: null,
      // Eşleme listesinde olmayan bir isim: departmanı boş kalır, "Diğer" sayılır.
      department: null,
      password_hash: null,
      is_manager: 0,
    });
    assert.equal(
      (db.prepare("PRAGMA integrity_check").get() as { integrity_check: string })
        .integrity_check,
      "ok",
    );
  });
});

describe("people.department migration'ı", () => {
  // Sütun eklenmeden önceki DB'de departman bilgisi yalnızca koda gömülü isim
  // listesindeydi; migration onu bir kez veriye taşımalı, yoksa mevcut ekip
  // güncelleme sonrası tamamen "Diğer" satırına düşerdi.
  function seedPeopleWithoutDepartment(names: [string, string][]): void {
    const legacy = new DatabaseSync(TMP_DB);
    legacy.exec(`
      CREATE TABLE people (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        title TEXT,
        bio TEXT,
        avatar_path TEXT,
        active INTEGER NOT NULL DEFAULT 1
      );
    `);
    const insert = legacy.prepare("INSERT INTO people (id, name) VALUES (?, ?)");
    for (const [id, name] of names) insert.run(id, name);
    legacy.close();
  }

  it("eski isim eşlemesinden departmanları geri dolduruyor", () => {
    seedPeopleWithoutDepartment([
      ["yunus", "Yunus Emre"],
      ["sila", "Sıla"],
      ["cansu", "Cansu"],
      ["yeni", "Yeni Üye"],
    ]);

    const db = getDb();
    const rows = db
      .prepare("SELECT id, department FROM people ORDER BY id")
      .all() as { id: string; department: string | null }[];

    assert.deepEqual(rows.map((row) => ({ ...row })), [
      { id: "cansu", department: "social" },
      { id: "sila", department: "design" },
      { id: "yeni", department: null },
      // Çok kelimeli isimde ilk kelime eşleşmeli ("Yunus Emre" → yunus).
      { id: "yunus", department: "video" },
    ]);
  });

  it("elle boşaltılan departmanı yeniden doldurmuyor (idempotent)", () => {
    seedPeopleWithoutDepartment([["yunus", "Yunus Emre"]]);

    const first = getDb();
    assert.equal(
      (first.prepare("SELECT department FROM people WHERE id='yunus'").get() as {
        department: string | null;
      }).department,
      "video",
    );
    // Kullanıcı arayüzden departmanı kaldırıyor.
    first.prepare("UPDATE people SET department = NULL WHERE id = 'yunus'").run();

    globalThis.__inturlamDb?.close();
    globalThis.__inturlamDb = undefined;

    const reopened = getDb();
    assert.equal(
      (reopened.prepare("SELECT department FROM people WHERE id='yunus'").get() as {
        department: string | null;
      }).department,
      null,
      "sütun zaten varsa geri doldurma tekrar çalışmamalı",
    );
  });

  it("belirlenen beş yöneticiye rapor rolünü bir kez tanımlar", () => {
    seedPeopleWithoutDepartment([
      ["yunus", "Yunus Emre"],
      ["sila", "Sıla"],
      ["ozgur", "Özgür"],
      ["berkant", "Berkant"],
      ["erhan", "Erhan"],
      ["cansu", "Cansu"],
    ]);

    const db = getDb();
    const rows = db
      .prepare("SELECT id, is_manager FROM people ORDER BY id")
      .all() as { id: string; is_manager: number }[];

    assert.deepEqual(rows.map((row) => ({ ...row })), [
      { id: "berkant", is_manager: 1 },
      { id: "cansu", is_manager: 0 },
      { id: "erhan", is_manager: 1 },
      { id: "ozgur", is_manager: 1 },
      { id: "sila", is_manager: 1 },
      { id: "yunus", is_manager: 1 },
    ]);
  });
});

describe("content_items tür migration'ı", () => {
  it("Post ve Story eklerken içerik, atanan, arşiv ve bağlı görevi koruyor", () => {
    const legacySchema = SCHEMA_SQL.replace(
      "'Reel','Post','Story','Foto'",
      "'Reel','Foto'",
    );
    assert.notEqual(legacySchema, SCHEMA_SQL, "test eski CHECK şemasını üretmeli");

    const legacy = new DatabaseSync(TMP_DB);
    legacy.exec("PRAGMA foreign_keys = ON");
    legacy.exec(legacySchema);
    legacy.prepare("INSERT INTO brands (id, name, cluster) VALUES ('b1', 'Marka', 'tek')").run();
    legacy.prepare("INSERT INTO people (id, name) VALUES ('p1', 'Ayşe')").run();
    legacy.prepare(
      `INSERT INTO content_items
         (id, brand_id, title, type, target_date, status, assignee_id, archived)
       VALUES ('c1', 'b1', 'Mevcut içerik', 'Reel', '2026-08-20', 'Uretimde', 'p1', 1)`,
    ).run();
    legacy.prepare(
      "INSERT INTO tasks (id, content_item_id, title) VALUES ('t1', 'c1', 'Bağlı görev')",
    ).run();
    legacy.close();

    const db = getDb();
    const content = db.prepare("SELECT * FROM content_items WHERE id = 'c1'").get() as
      | Record<string, unknown>
      | undefined;
    assert.equal(content?.title, "Mevcut içerik");
    assert.equal(content?.type, "Reel");
    assert.equal(content?.target_date, "2026-08-20");
    assert.equal(content?.status, "Uretimde");
    assert.equal(content?.assignee_id, "p1");
    assert.equal(content?.archived, 1);
    assert.equal(
      (db.prepare("SELECT content_item_id FROM tasks WHERE id = 't1'").get() as {
        content_item_id: string;
      }).content_item_id,
      "c1",
    );

    db.prepare(
      "INSERT INTO content_items (id, brand_id, title, type) VALUES ('post', 'b1', 'Post işi', 'Post')",
    ).run();
    db.prepare(
      "INSERT INTO content_items (id, brand_id, title, type) VALUES ('story', 'b1', 'Story işi', 'Story')",
    ).run();
    assert.deepEqual(
      (db.prepare("SELECT type FROM content_items WHERE id IN ('post','story') ORDER BY id").all() as {
        type: string;
      }[]).map((row) => row.type),
      ["Post", "Story"],
    );
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(
      (db.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check,
      "ok",
    );
  });
});

describe("social_posts UNIQUE migration'ı", () => {
  it("aynı gönderiyi iki markaya (ortak gönderi/collab) ayrı ayrı yazabiliyor, veri kaybetmiyor", () => {
    const legacySchema = SCHEMA_SQL.replace(
      "UNIQUE (brand_id, platform, external_id)",
      "UNIQUE (platform, external_id)",
    );
    assert.notEqual(legacySchema, SCHEMA_SQL, "test eski UNIQUE şemasını üretmeli");

    const legacy = new DatabaseSync(TMP_DB);
    legacy.exec("PRAGMA foreign_keys = ON");
    legacy.exec(legacySchema);
    legacy.prepare("INSERT INTO brands (id, name, cluster) VALUES ('marka-a', 'Marka A', 'tek')").run();
    legacy.prepare("INSERT INTO brands (id, name, cluster) VALUES ('marka-b', 'Marka B', 'tek')").run();
    legacy.prepare(
      `INSERT INTO social_posts (id, brand_id, platform, external_id, posted_at)
       VALUES ('sp1', 'marka-a', 'instagram', 'eski-gonderi', '2026-08-01T00:00:00.000Z')`,
    ).run();
    legacy.close();

    const db = getDb();
    // Eski satır (migration'dan önce yazılmış) kaybolmamalı.
    const existing = db.prepare("SELECT * FROM social_posts WHERE id = 'sp1'").get() as
      | Record<string, unknown>
      | undefined;
    assert.equal(existing?.brand_id, "marka-a");
    assert.equal(existing?.external_id, "eski-gonderi");

    // Asıl senaryo: ORTAK gönderi — aynı external_id, iki farklı marka.
    // Eski kısıtta (platform, external_id) ikinci INSERT sessizce düşerdi.
    db.prepare(
      `INSERT OR IGNORE INTO social_posts (id, brand_id, platform, external_id, posted_at)
       VALUES ('sp2', 'marka-a', 'instagram', 'ortak-gonderi', '2026-08-09T00:00:00.000Z')`,
    ).run();
    db.prepare(
      `INSERT OR IGNORE INTO social_posts (id, brand_id, platform, external_id, posted_at)
       VALUES ('sp3', 'marka-b', 'instagram', 'ortak-gonderi', '2026-08-09T00:00:00.000Z')`,
    ).run();
    const rows = db
      .prepare("SELECT brand_id FROM social_posts WHERE external_id = 'ortak-gonderi' ORDER BY brand_id")
      .all() as { brand_id: string }[];
    assert.deepEqual(rows.map((r) => r.brand_id), ["marka-a", "marka-b"]);

    // Aynı marka için tekrar hâlâ engellenir (idempotent tarama).
    db.prepare(
      `INSERT OR IGNORE INTO social_posts (id, brand_id, platform, external_id, posted_at)
       VALUES ('sp2-tekrar', 'marka-a', 'instagram', 'ortak-gonderi', '2026-08-09T00:00:00.000Z')`,
    ).run();
    const count = db
      .prepare("SELECT COUNT(*) AS n FROM social_posts WHERE external_id = 'ortak-gonderi' AND brand_id = 'marka-a'")
      .get() as { n: number };
    assert.equal(count.n, 1);

    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(
      (db.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check,
      "ok",
    );
  });
});

describe("sosyal medya üretim planı tabloları (yeni tablolar, migration YOK)", () => {
  it("eski (bu üç tablodan önceki) bir DB açılınca üçü de kurulur, mevcut veri korunur", () => {
    // brand_content_targets/brand_asset_counts/brand_plan_entries CREATE
    // TABLE bloklarını şemadan çıkarıp "bu üç tablo hiç yokmuş" gibi eski bir
    // DB kuruyoruz — asıl senaryo: bunlar YENİ tablo olduğu için migration
    // fonksiyonu yok, getDb()'nin normal `CREATE TABLE IF NOT EXISTS` geçişi
    // onları kurmalı.
    const legacySchema = SCHEMA_SQL
      .replace(/CREATE TABLE IF NOT EXISTS brand_content_targets[\s\S]*?\);\r?\n\r?\n/, "")
      .replace(/CREATE TABLE IF NOT EXISTS brand_asset_counts[\s\S]*?\);\r?\n\r?\n/, "")
      .replace(/CREATE TABLE IF NOT EXISTS brand_plan_entries[\s\S]*?\);\r?\n\r?\n/, "")
      .replace(
        /CREATE INDEX IF NOT EXISTS idx_brand_plan_entries_date ON brand_plan_entries\(plan_date\);\r?\n/,
        "",
      );
    assert.notEqual(legacySchema, SCHEMA_SQL, "test üç tablonun gerçekten çıkarıldığını üretmeli");
    for (const table of ["brand_content_targets", "brand_asset_counts", "brand_plan_entries"]) {
      assert.ok(!legacySchema.includes(table), `${table} legacy şemada hâlâ geçiyor`);
    }

    const legacy = new DatabaseSync(TMP_DB);
    legacy.exec("PRAGMA foreign_keys = ON");
    legacy.exec(legacySchema);
    legacy.prepare("INSERT INTO brands (id, name, cluster) VALUES ('b1', 'Test Marka', 'tek')").run();
    legacy.close();

    const db = getDb();
    const tableNames = (
      db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table'
             AND name IN ('brand_content_targets','brand_asset_counts','brand_plan_entries')`,
        )
        .all() as { name: string }[]
    ).map((row) => row.name);
    assert.deepEqual(
      tableNames.sort(),
      ["brand_asset_counts", "brand_content_targets", "brand_plan_entries"],
    );

    // Mevcut markaya karşı üçüne de yazılabiliyor mu — asıl amaç bu.
    db.prepare(
      "INSERT INTO brand_content_targets (brand_id, kind, monthly_target) VALUES ('b1', 'Post', 15)",
    ).run();
    db.prepare(
      "INSERT INTO brand_asset_counts (brand_id, kind, ready_count) VALUES ('b1', 'Post', 7)",
    ).run();
    db.prepare(
      "INSERT INTO brand_plan_entries (brand_id, plan_date, combo) VALUES ('b1', '2026-08-10', 'Post')",
    ).run();

    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(
      (db.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check,
      "ok",
    );
  });
});

describe("müşteri talebi tabloları (yeni tablolar, migration YOK)", () => {
  it("mevcut veritabanını açınca talep tablolarını veri kaybetmeden kurar", () => {
    const legacySchema = SCHEMA_SQL
      .replace(/CREATE TABLE IF NOT EXISTS client_requests[\s\S]*?\);\r?\n\r?\n/, "")
      .replace(/CREATE TABLE IF NOT EXISTS client_request_comments[\s\S]*?\);\r?\n\r?\n/, "")
      .replace(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS idx_client_request[\s\S]*?;\r?\n/g, "");

    const legacy = new DatabaseSync(TMP_DB);
    legacy.exec("PRAGMA foreign_keys = ON");
    legacy.exec(legacySchema);
    legacy.prepare("INSERT INTO brands (id, name, cluster) VALUES ('b1', 'Korunan Marka', 'tek')").run();
    legacy.close();

    const db = getDb();
    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table'
         AND name IN ('client_requests', 'client_request_comments') ORDER BY name`,
      )
      .all() as { name: string }[];
    assert.deepEqual(tables.map((row) => row.name), [
      "client_request_comments",
      "client_requests",
    ]);
    assert.equal(
      (db.prepare("SELECT name FROM brands WHERE id = 'b1'").get() as { name: string }).name,
      "Korunan Marka",
    );
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(
      (db.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check,
      "ok",
    );
  });
});
