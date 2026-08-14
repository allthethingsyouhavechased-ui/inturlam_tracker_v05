import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

// Varsayılan tek dosya; `INTURLAM_DB_PATH` ile değiştirilebilir. Bunun tek
// gerçek kullanıcısı testler (geçici DB) ve yedekleme/geri yükleme script'leri —
// gerçek veriye asla dokunmasınlar diye.
const DB_PATH =
  process.env.INTURLAM_DB_PATH ?? path.join(process.cwd(), "data", "inturlam.db");
const SCHEMA_PATH = path.join(process.cwd(), "lib", "db", "schema.sql");

declare global {
  var __inturlamDb: DatabaseSync | undefined;
}

function createConnection(): DatabaseSync {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");
  // Next dev sunucusunun render-worker alt süreçleri her biri kendi ilk DB
  // dokunuşunda bu bağlantıyı açar (globalThis singleton'ı sadece kendi süreci
  // içinde korur); busy_timeout olmadan aynı WAL dosyasına eşzamanlı ilk açılış
  // + migration DDL'i SQLITE_BUSY ile çakışabilir.
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = ON");
  const schemaSql = fs.readFileSync(SCHEMA_PATH, "utf-8");
  try {
    db.exec(schemaSql);
  } catch {
    // schema.sql, henüz migrate edilmemiş eski bir tabloya yeni bir sütun/indeks
    // varsayıyor olabilir (ör. yeni eklenen bir sütun üzerinde CREATE INDEX).
    // Migration'lar tabloyu düzeltir, aşağıda şema ikinci kez uygulanır — o
    // geçişte artık hata vermez. Önceki CREATE TABLE/INDEX ifadeleri bu satıra
    // kadar zaten no-op ya da başarılı şekilde uygulanmış olur.
  }
  migrateBrandsTableIfNeeded(db);
  seedClustersIfNeeded(db);
  migrateBrandsDropClusterCheckIfNeeded(db);
  migrateContentItemsTableIfNeeded(db);
  migrateContentItemsArchivedIfNeeded(db);
  migrateContentItemTypesIfNeeded(db);
  migrateTasksTableIfNeeded(db);
  migrateTasksRepeatIfNeeded(db);
  migrateTasksReportingIfNeeded(db);
  migrateTasksArchivedAtIfNeeded(db);
  migratePeopleProfilesIfNeeded(db);
  migratePeopleDepartmentIfNeeded(db);
  migratePeopleAuthIfNeeded(db);
  migratePeopleUsernameIfNeeded(db);
  migrateV03TaskColumnsIfNeeded(db);
  migrateTaskTemplateDifficultyIfNeeded(db);
  migrateV03AccountsIfNeeded(db);
  migrateV03NotificationColumnsIfNeeded(db);
  migrateCalendarEventColorIfNeeded(db);
  migrateSocialPostsUniqueIfNeeded(db);
  migrateClientRequestsArchiveIfNeeded(db);
  // SIRA ÖNEMLİ: yukarıdaki iki brands migration'ı tabloyu SABİT bir sütun
  // listesiyle yeniden kuruyor; bu ALTER onlardan sonra çalışmalı, yoksa
  // eklediği sütun rebuild sırasında düşer.
  migrateBrandsStatsUpdatedIfNeeded(db);
  migrateBrandsOperationsIfNeeded(db);
  db.exec(schemaSql);
  seedTaskTemplatesIfNeeded(db);
  return db;
}

// Takvim renkleri sınırlı bir palet anahtarı olarak saklanır. Eski v03
// etkinlikleri mevcut tür renklerini korumak için `auto` ile taşınır.
function migrateCalendarEventColorIfNeeded(db: DatabaseSync): void {
  const exists = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='calendar_events'`)
    .get();
  if (!exists) return;
  const columns = db.prepare(`PRAGMA table_info(calendar_events)`).all() as { name: string }[];
  if (!columns.some((column) => column.name === "color_key")) {
    db.exec(`ALTER TABLE calendar_events ADD COLUMN color_key TEXT NOT NULL DEFAULT 'auto'
      CHECK (color_key IN ('auto','purple','blue','cyan','green','amber','rose','slate'))`);
  }
}

// v03 görev alanları düz/nullable ya da güvenli DEFAULT taşır. Eski v02
// satırları ekip kaynaklı ve 1 puan kabul edilir; tarih veya sahiplik bilgisi
// uydurulmaz.
function migrateV03TaskColumnsIfNeeded(db: DatabaseSync): void {
  const exists = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='tasks'`)
    .get();
  if (!exists) return;

  const columns = db.prepare(`PRAGMA table_info(tasks)`).all() as { name: string }[];
  const additions: ReadonlyArray<readonly [string, string]> = [
    ["weight_points", "INTEGER NOT NULL DEFAULT 1 CHECK (weight_points BETWEEN 1 AND 100)"],
    ["difficulty", "TEXT CHECK (difficulty IN ('Kolay','Orta','Zor','Ozel'))"],
    ["type_override", "TEXT CHECK (type_override IN ('Reel','Post','Story','Foto','Kampanya','Video','Carousel','KurumsalKimlik','Diger'))"],
    ["origin", "TEXT NOT NULL DEFAULT 'team' CHECK (origin IN ('team','guest'))"],
    ["requested_date", "TEXT"],
    ["guest_brief", "TEXT"],
    ["created_by_account_id", "TEXT REFERENCES accounts(id) ON DELETE SET NULL"],
  ];
  for (const [name, definition] of additions) {
    if (!columns.some((column) => column.name === name)) {
      db.exec(`ALTER TABLE tasks ADD COLUMN ${name} ${definition}`);
    }
  }
  // Görev türü eskiden bağlı çalışmadan okunuyordu. Sütun ilk kez eklendiğinde
  // o anki görünen değeri göreve kopyala; bundan sonra çalışma türü değişse bile
  // mevcut görevlerin anlamı sessizce değişmesin.
  db.exec(`
    UPDATE tasks
       SET type_override = (
         SELECT ci.type FROM content_items ci WHERE ci.id = tasks.content_item_id
       )
     WHERE type_override IS NULL
  `);
}

function migrateTaskTemplateDifficultyIfNeeded(db: DatabaseSync): void {
  const exists = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='task_template_items'`)
    .get();
  if (!exists) return;
  const columns = db.prepare(`PRAGMA table_info(task_template_items)`).all() as { name: string }[];
  if (!columns.some((column) => column.name === "difficulty")) {
    db.exec(`ALTER TABLE task_template_items ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'Orta'
      CHECK (difficulty IN ('Kolay','Orta','Zor','Ozel'))`);
  }
}

// Her mevcut person için kararlı bir team hesabı oluşturur. people tablosundaki
// eski password_hash silinmez; v03 hesabı ilk kez oluşurken kayıpsız kopyalanır.
function migrateV03AccountsIfNeeded(db: DatabaseSync): void {
  const exists = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='accounts'`)
    .get();
  if (!exists) return;

  db.exec(`
    INSERT OR IGNORE INTO accounts
      (id, kind, person_id, brand_id, username, password_hash, active)
    SELECT 'team:' || id, 'team', id, NULL, NULL, password_hash, active
      FROM people
  `);
  db.exec(`
    UPDATE accounts
       SET password_hash = (
             SELECT p.password_hash FROM people p WHERE p.id = accounts.person_id
           ),
           active = COALESCE((
             SELECT p.active FROM people p WHERE p.id = accounts.person_id
           ), active),
           updated_at = datetime('now')
     WHERE kind = 'team'
       AND person_id IS NOT NULL
       AND password_hash IS NULL
  `);
}

// Guest etkinlik bildirimleri aynı bildirim tablosunda, alıcı olarak guest
// account id'sini kullanır. Olay id'si ayrı sütundur; task_id alanını takvim
// olayı için yeniden kullanıp iki kavramı birbirine karıştırmıyoruz.
function migrateV03NotificationColumnsIfNeeded(db: DatabaseSync): void {
  const exists = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='notifications'`)
    .get();
  if (!exists) return;
  const columns = db.prepare(`PRAGMA table_info(notifications)`).all() as { name: string }[];
  if (!columns.some((column) => column.name === "calendar_event_id")) {
    db.exec(`ALTER TABLE notifications ADD COLUMN calendar_event_id TEXT`);
  }
}

// Ön talep kayıtları onay/ret kararından yedi gün sonra listeden arşive
// taşınır. Eski LAN veritabanlarına nullable damga eklemek veri kaybetmeden
// ALTER TABLE ile yapılabilir; ek tablosunu schema.sql ayrıca kurar.
function migrateClientRequestsArchiveIfNeeded(db: DatabaseSync): void {
  const exists = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='client_requests'`)
    .get();
  if (!exists) return;
  const columns = db.prepare(`PRAGMA table_info(client_requests)`).all() as { name: string }[];
  if (!columns.some((column) => column.name === "archived_at")) {
    db.exec(`ALTER TABLE client_requests ADD COLUMN archived_at TEXT`);
  }
}

// brands.stats_updated_at — takipçi/gönderi sayılarının en son ne zaman
// tazelendiği. Sayılar haftalık elle güncelleniyor; damga olmadan ekrandaki
// rakamın geçen haftadan mı yoksa aylar öncesinden mi kaldığı anlaşılmıyor.
// Düz sütun, CHECK/FK yok → ALTER yeterli. Idempotent: sütun varsa no-op.
function migrateBrandsStatsUpdatedIfNeeded(db: DatabaseSync): void {
  const exists = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='brands'`)
    .get();
  if (!exists) return;
  const columns = db.prepare(`PRAGMA table_info(brands)`).all() as { name: string }[];
  if (columns.some((c) => c.name === "stats_updated_at")) return;
  db.exec(`ALTER TABLE brands ADD COLUMN stats_updated_at TEXT`);
}

// Aylık/yıllık çekim hakları eski snapshot'larda bulunmaz. NULL bilinçli bir
// boş durumdur: kota tanımlanmamış markaya yapay bir 0 hakkı yazılmaz.
function migrateBrandsOperationsIfNeeded(db: DatabaseSync): void {
  const exists = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='brands'`)
    .get();
  if (!exists) return;
  const columns = db.prepare(`PRAGMA table_info(brands)`).all() as { name: string }[];
  if (!columns.some((column) => column.name === "monthly_shoot_allowance")) {
    db.exec(`ALTER TABLE brands ADD COLUMN monthly_shoot_allowance INTEGER CHECK (monthly_shoot_allowance >= 0)`);
  }
  if (!columns.some((column) => column.name === "annual_shoot_allowance")) {
    db.exec(`ALTER TABLE brands ADD COLUMN annual_shoot_allowance INTEGER CHECK (annual_shoot_allowance >= 0)`);
  }
}

// tasks.repeat_days — tekrar eden görevler için. CHECK/FK içermediği için
// tabloyu yeniden kurmaya gerek yok, düz ALTER yeterli (client.ts'teki kırılgan
// rebuild desenine bulaşmıyoruz). Idempotent: sütun varsa no-op.
function migrateTasksRepeatIfNeeded(db: DatabaseSync): void {
  const tasksExists = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='tasks'`)
    .get();
  if (!tasksExists) return;
  const columns = db.prepare(`PRAGMA table_info(tasks)`).all() as { name: string }[];
  if (columns.some((c) => c.name === "repeat_days")) return;
  db.exec(`ALTER TABLE tasks ADD COLUMN repeat_days INTEGER`);
}

// people profil alanları düz ve nullable sütunlardır. Eski LAN veritabanlarında
// yalnızca id/name/active bulunduğu için tabloyu yeniden kurmadan, veri kaybı
// riski taşımayan idempotent ALTER'larla eklenir.
function migratePeopleProfilesIfNeeded(db: DatabaseSync): void {
  const peopleExists = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='people'`)
    .get();
  if (!peopleExists) return;

  const columns = db.prepare(`PRAGMA table_info(people)`).all() as { name: string }[];
  for (const [name, definition] of [
    ["title", "TEXT"],
    ["bio", "TEXT"],
    ["avatar_path", "TEXT"],
  ] as const) {
    if (!columns.some((column) => column.name === name)) {
      db.exec(`ALTER TABLE people ADD COLUMN ${name} ${definition}`);
    }
  }
}

// Departman ataması, `lib/teamWorkstreams.ts` içinde sabit bir ilk-isim listesi
// olarak duruyordu; artık `people.department` sütununda. Bu liste o eski
// eşlemenin DONMUŞ bir kopyası: yalnızca sütun ilk eklendiğinde, mevcut ekibin
// ataması kaybolmasın diye bir kez geri doldurmak için kullanılır.
// DEPARTMENTS ileride değişse bile buraya dokunma — geçmiş bir veri anlık
// görüntüsüdür, canlı bir yapılandırma değil. (Kasıtlı olarak lib/departments.ts'i
// import etmiyor: client.ts, `db/*.mts` script'leri tarafından Node'un native TS
// çalıştırıcısıyla yükleniyor ve orada `@/` alias'ı çözülmez.)
const LEGACY_DEPARTMENT_FIRST_NAMES: Record<string, string> = {
  yunus: "video",
  emrullah: "video",
  arman: "video",
  özgün: "video",
  erhan: "video",
  murat: "design",
  ekin: "design",
  sıla: "design",
  cansu: "social",
  defne: "social",
  özgür: "management",
  berkant: "management",
};

// people.department — düz, nullable, CHECK/FK içermeyen sütun → ALTER yeterli.
// Idempotent: sütun varsa hem ALTER hem geri doldurma atlanır (kullanıcı sonradan
// birinin departmanını boşalttıysa her açılışta geri gelmesin).
function migratePeopleDepartmentIfNeeded(db: DatabaseSync): void {
  const peopleExists = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='people'`)
    .get();
  if (!peopleExists) return;

  const columns = db.prepare(`PRAGMA table_info(people)`).all() as { name: string }[];
  if (columns.some((column) => column.name === "department")) return;

  db.exec(`ALTER TABLE people ADD COLUMN department TEXT`);

  const rows = db.prepare(`SELECT id, name FROM people`).all() as {
    id: string;
    name: string;
  }[];
  const update = db.prepare(`UPDATE people SET department = ? WHERE id = ?`);
  for (const row of rows) {
    const firstName = row.name.trim().toLocaleLowerCase("tr-TR").split(/\s+/)[0] ?? "";
    const department = LEGACY_DEPARTMENT_FIRST_NAMES[firstName];
    if (department) update.run(department, row.id);
  }
}

// people.username — ekip giriş adının kişi id'sinden ayrılması. Eskiden giriş
// ekranına yazılan metin doğrudan `people.id` (ya da tam ad) ile eşleştiriliyordu;
// id ise onlarca tabloda FK olduğu için değiştirilemez, dolayısıyla kullanıcı adı
// da düzeltilemiyordu. `accounts.username` kullanılamaz: o sütunun CHECK'i ekip
// satırlarında NULL olmasını şart koşuyor. Sütun eklenirken geri doldurma: id'si
// zaten insan okunabilir bir kısaltma olan kayıtlar ("yunus", "erhan") onu
// kullanıcı adı olarak devralır — bu kişiler değişiklikten sonra da AYNI metinle
// giriş yapar. UUID id'li kayıtlar (arayüzden eklenen ekip üyeleri) desene
// uymadığı için boş kalır; onlar hesap yönetiminde "belirlenmedi" görünür ve
// giriş için eskiden beri işleyen tam-ad eşleşmesini kullanmaya devam eder.
function migratePeopleUsernameIfNeeded(db: DatabaseSync): void {
  const peopleExists = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='people'`)
    .get();
  if (!peopleExists) return;

  const columns = db.prepare(`PRAGMA table_info(people)`).all() as { name: string }[];
  if (columns.some((column) => column.name === "username")) return;

  db.exec(`ALTER TABLE people ADD COLUMN username TEXT`);
  // Desen lib/username.ts'teki USERNAME_PATTERN'in SQL karşılığı (GLOB
  // büyük/küçük harfe duyarlı, karakter sınıflarıyla yazılıyor). UUID'ler
  // 36 karakter olduğu için uzunluk üst sınırına takılıp elenir.
  db.exec(
    `UPDATE people
        SET username = lower(id)
      WHERE username IS NULL
        AND length(id) BETWEEN 3 AND 32
        AND id GLOB '[A-Za-z0-9]*'
        AND NOT id GLOB '*[^A-Za-z0-9._-]*'`,
  );
}

// Mevcut LAN kurulumunda hesaplar şifresizdi. Düz sütunlarla veri kaybetmeden
// kimlik doğrulama alanları eklenir. Yönetici geri doldurması yalnızca rol
// sütunu ilk kez eklenirken çalışır; sonraki elle yapılan rol değişikliklerini
// uygulama açılışında sessizce ezmez.
function migratePeopleAuthIfNeeded(db: DatabaseSync): void {
  const peopleExists = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='people'`)
    .get();
  if (!peopleExists) return;

  const columns = db.prepare(`PRAGMA table_info(people)`).all() as { name: string }[];
  if (!columns.some((column) => column.name === "password_hash")) {
    db.exec(`ALTER TABLE people ADD COLUMN password_hash TEXT`);
  }

  const managerColumnAdded = !columns.some((column) => column.name === "is_manager");
  if (!managerColumnAdded) return;

  db.exec(`ALTER TABLE people ADD COLUMN is_manager INTEGER NOT NULL DEFAULT 0`);
  const managerFirstNames = new Set(["sıla", "özgür", "berkant", "yunus", "erhan"]);
  const rows = db.prepare(`SELECT id, name FROM people`).all() as {
    id: string;
    name: string;
  }[];
  const grantManager = db.prepare(`UPDATE people SET is_manager = 1 WHERE id = ?`);
  for (const row of rows) {
    const firstName = row.name.trim().toLocaleLowerCase("tr-TR").split(/\s+/)[0] ?? "";
    if (managerFirstNames.has(firstName)) grantManager.run(row.id);
  }
}

// Raporların oluşturulma tarihi yerine gerçek tamamlanma zamanını kullanabilmesi
// için iki düz sütun eklenir. Eski yayınlanmış görevlerde kesin bir geçmiş yok;
// updated_at en iyi mevcut başlangıç değeri olarak yalnızca bir kez geri doldurulur.
function migrateTasksReportingIfNeeded(db: DatabaseSync): void {
  const tasksExists = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='tasks'`)
    .get();
  if (!tasksExists) return;

  const columns = db.prepare(`PRAGMA table_info(tasks)`).all() as { name: string }[];
  if (!columns.some((c) => c.name === "completed_at")) {
    db.exec(`ALTER TABLE tasks ADD COLUMN completed_at TEXT`);
  }
  if (!columns.some((c) => c.name === "completed_by")) {
    db.exec(
      `ALTER TABLE tasks ADD COLUMN completed_by TEXT REFERENCES people(id) ON DELETE SET NULL`,
    );
  }
  db.exec(`
    UPDATE tasks
       SET completed_at = updated_at
     WHERE status = 'Yayinlandi' AND completed_at IS NULL
  `);
}

// tasks.archived_at — "Yayınlandı" görevin panodan ne zaman çekildiği. Düz,
// nullable, CHECK/FK içermeyen sütun → ALTER yeterli. Idempotent: sütun varsa
// no-op. Geri doldurma YOK: mevcut yayınlanmış işler bilinçli olarak arşivsiz
// başlar; ilk süpürme (`sweepArchivablePublishedTasks`) tamamlanma tarihine
// bakıp eskileri zaten damgalayacak, böylece kural tek yerde kalır.
function migrateTasksArchivedAtIfNeeded(db: DatabaseSync): void {
  const tasksExists = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='tasks'`)
    .get();
  if (!tasksExists) return;
  const columns = db.prepare(`PRAGMA table_info(tasks)`).all() as { name: string }[];
  if (columns.some((c) => c.name === "archived_at")) return;
  db.exec(`ALTER TABLE tasks ADD COLUMN archived_at TEXT`);
}

// Ajansın her markada tekrarlayan iş akışları — başlangıç içeriği.
// YALNIZCA tablo tamamen boşken tohumlanır: kullanıcı bir şablonu silerse her
// sunucu açılışında geri gelmesin. (Kategorilerdeki id bazlı `INSERT OR IGNORE`
// deseni bu yüzden burada bilinçli olarak tekrarlanmadı.)
const DEFAULT_TEMPLATES: {
  id: string;
  name: string;
  contentType: string | null;
  items: { title: string; priority: string; difficulty?: string; offset: number | null }[];
}[] = [
  {
    id: "reel-akisi",
    name: "Reel akışı",
    contentType: "Reel",
    items: [
      { title: "Brief ve konsept", priority: "Normal", offset: -10 },
      { title: "Çekim", priority: "Yuksek", offset: -6 },
      { title: "Kurgu + altyazı", priority: "Yuksek", offset: -3 },
      { title: "Kapak görseli", priority: "Yuksek", offset: -2 },
      { title: "Onay ve yayın", priority: "Normal", offset: 0 },
    ],
  },
  {
    id: "foto-cekimi",
    name: "Foto çekimi",
    contentType: "Foto",
    items: [
      { title: "Çekim listesi hazırla", priority: "Normal", offset: -5 },
      { title: "Çekim", priority: "Yuksek", offset: -3 },
      { title: "Retuş ve seçim", priority: "Normal", offset: -1 },
      { title: "Teslim", priority: "Normal", offset: 0 },
    ],
  },
  {
    id: "kampanya",
    name: "Kampanya",
    contentType: "Kampanya",
    items: [
      { title: "Konsept ve slogan", priority: "Yuksek", offset: -14 },
      { title: "Görsel/video üretimi", priority: "Yuksek", offset: -7 },
      { title: "Metin ve CTA", priority: "Normal", offset: -5 },
      { title: "Yayın takvimi onayı", priority: "Normal", offset: -2 },
      { title: "İlk hafta performans raporu", priority: "Dusuk", offset: 7 },
    ],
  },
];

function seedTaskTemplatesIfNeeded(db: DatabaseSync): void {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM task_templates").get() as {
    n: number;
  };
  if (n > 0) return;

  const insertTemplate = db.prepare(
    "INSERT OR IGNORE INTO task_templates (id, name, content_type, sort_order) VALUES (?, ?, ?, ?)",
  );
  const insertItem = db.prepare(
    `INSERT OR IGNORE INTO task_template_items
       (id, template_id, title, priority, difficulty, due_offset_days, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  DEFAULT_TEMPLATES.forEach((t, i) => {
    insertTemplate.run(t.id, t.name, t.contentType, (i + 1) * 10);
    t.items.forEach((item, j) => {
      insertItem.run(`${t.id}-${j + 1}`, t.id, item.title, item.priority, item.difficulty ?? "Orta", item.offset, (j + 1) * 10);
    });
  });
}

// brands.cluster üzerindeki CHECK kısıtlamasının VAR olup olmadığını anlamak için.
// sqlite_master tablonun CREATE metnini birebir sakladığı için boşluk/kalıp
// değişimlerine dayanıklı olsun diye regex.
const CLUSTER_CHECK_RE = /CHECK\s*\(\s*cluster\s+IN/i;

// Kategoriler `clusters` tablosuna taşınmadan önceki sabit liste. Sadece
// tohumlama için: mevcut DB'lerde marka→kategori eşleşmesi bozulmasın diye
// aynı id'lerle bir kez eklenir, sonrası kullanıcının elinde.
const DEFAULT_CLUSTERS: { id: string; label: string }[] = [
  { id: "balik-deniz", label: "Balık & Deniz" },
  { id: "kahve-gida", label: "Kahve & Gıda" },
  { id: "b2b-yapi", label: "B2B / Yapı" },
  { id: "hamam", label: "Hamam" },
  { id: "emlak", label: "Gayrimenkul" },
  { id: "tek", label: "Diğer" },
];

// clusters tablosunu kurar, varsayılan 6 kategoriyi ekler ve markalarda geçen
// ama tabloda karşılığı olmayan kategori id'lerini de (etiketi = id) yakalar —
// böylece elle düzenlenmiş bir DB'de hiçbir marka gruplanamadan kalmaz.
// Idempotent: INSERT OR IGNORE, var olan etiketleri ezmez.
function seedClustersIfNeeded(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clusters (
      id         TEXT PRIMARY KEY,
      label      TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const insert = db.prepare(
    "INSERT OR IGNORE INTO clusters (id, label, sort_order) VALUES (?, ?, ?)",
  );
  DEFAULT_CLUSTERS.forEach((c, i) => insert.run(c.id, c.label, (i + 1) * 10));

  const brandsExists = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='brands'`)
    .get();
  if (!brandsExists) return;

  const orphans = db
    .prepare(
      `SELECT DISTINCT cluster FROM brands
        WHERE cluster IS NOT NULL AND cluster <> ''
          AND cluster NOT IN (SELECT id FROM clusters)`,
    )
    .all() as { cluster: string }[];
  const nextOrder =
    ((db.prepare("SELECT MAX(sort_order) AS m FROM clusters").get() as
      | { m: number | null }
      | undefined)?.m ?? 0) + 10;
  orphans.forEach((o, i) => insert.run(o.cluster, o.cluster, nextOrder + i * 10));
}

// Kategoriler kullanıcı tarafından eklenebilir hale gelince brands.cluster
// üzerindeki sabit CHECK kısıtlaması kaldırılmalı. SQLite CHECK'i ALTER ile
// düşüremediği için tablo yeniden kuruluyor — yine "YENİ tabloyu geçici isimle
// kur, veriyi kopyala, eskiyi sil, yeniyi doğru isme çevir" deseniyle (bkz.
// migrateBrandsTableIfNeeded'daki uzun açıklama). Bu sefer TÜM sütunlar
// kopyalanıyor. Idempotent: CHECK yoksa no-op.
function migrateBrandsDropClusterCheckIfNeeded(db: DatabaseSync): void {
  const row = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='brands'`)
    .get() as { sql: string } | undefined;
  if (!row || !CLUSTER_CHECK_RE.test(row.sql)) return;

  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.exec("BEGIN");
    db.exec(`
      CREATE TABLE brands_new_migration (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        cluster    TEXT NOT NULL,
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
    `);
    db.exec(`
      INSERT INTO brands_new_migration
        (id, name, cluster, sort_order, archived, logo_path, instagram_handle,
         follower_count, post_count, median_reel_views, cover_test_verdict,
         cover_test_note, key_finding, first_action, tier)
      SELECT
         id, name, cluster, sort_order, archived, logo_path, instagram_handle,
         follower_count, post_count, median_reel_views, cover_test_verdict,
         cover_test_note, key_finding, first_action, tier
      FROM brands
    `);
    db.exec(`DROP TABLE brands`);
    db.exec(`ALTER TABLE brands_new_migration RENAME TO brands`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_brands_cluster ON brands(cluster)`);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

// brands tablosu 19-marka/6-küme genişlemesinden önce kurulmuş olabilir — CHECK
// kısıtlaması SQLite'ta doğrudan ALTER edilemediği için tabloyu yeniden kurmak
// gerekiyor. ÖNEMLİ: SQLite `ALTER TABLE brands RENAME TO x` yaptığında diğer
// tabloların (content_items, brand_relations, brand_audits) FK referans metnini
// otomatik olarak "x"e günceller — bu yüzden ESKİ tabloyu yeniden adlandırmak
// yerine YENİ tabloyu geçici isimle kurup veriyi kopyalıyoruz, eskiyi siliyoruz,
// sonra yeniyi "brands"e çeviriyoruz. Böylece diğer tabloların FK metni hep
// "brands" olarak kalır, hiç bozulmaz. Idempotent: yeni şemayla kurulmuş bir
// DB'de no-op.
function migrateBrandsTableIfNeeded(db: DatabaseSync): void {
  const row = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='brands'`)
    .get() as { sql: string } | undefined;
  // CHECK zaten tamamen kaldırılmışsa (dinamik kategorilere geçilmiş DB) bu
  // migration'ın çalışmaması ŞART — yalnızca 5 sütun kopyaladığı için geri
  // kalan marka verisini silerdi.
  if (!row || !CLUSTER_CHECK_RE.test(row.sql) || row.sql.includes("'emlak'")) return;

  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.exec("BEGIN");
    db.exec(`
      CREATE TABLE brands_new_migration (
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
    `);
    db.exec(`
      INSERT INTO brands_new_migration (id, name, cluster, sort_order, archived)
      SELECT id, name, cluster, sort_order, archived FROM brands
    `);
    db.exec(`DROP TABLE brands`);
    db.exec(`ALTER TABLE brands_new_migration RENAME TO brands`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_brands_cluster ON brands(cluster)`);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

// content_items tablosu Carousel/Kurumsal Kimlik türleri ve assignee_id'den önce
// kurulmuş olabilir — aynı "yeni tabloyu geçici isimle kur, veriyi kopyala, eskiyi
// sil, yeniyi doğru isme çevir" deseni (bkz. migrateBrandsTableIfNeeded). tasks
// tablosunun content_item_id FK'si etkilenmez çünkü content_items adı hiç
// değişmeden kalıyor.
function migrateContentItemsTableIfNeeded(db: DatabaseSync): void {
  const row = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='content_items'`)
    .get() as { sql: string } | undefined;
  if (!row || row.sql.includes("'Carousel'")) return;

  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.exec("BEGIN");
    db.exec(`
      CREATE TABLE content_items_new_migration (
        id          TEXT PRIMARY KEY,
        brand_id    TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
        title       TEXT NOT NULL,
        type        TEXT NOT NULL CHECK (type IN ('Reel','Post','Story','Foto','Kampanya','Video','Carousel','KurumsalKimlik','Diger')),
        target_date TEXT,
        status      TEXT NOT NULL DEFAULT 'Planlandi' CHECK (status IN ('Planlandi','Uretimde','Tamamlandi','IptalEdildi')),
        assignee_id TEXT REFERENCES people(id) ON DELETE SET NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec(`
      INSERT INTO content_items_new_migration
        (id, brand_id, title, type, target_date, status, created_at, updated_at)
      SELECT id, brand_id, title, type, target_date, status, created_at, updated_at
      FROM content_items
    `);
    db.exec(`DROP TABLE content_items`);
    db.exec(`ALTER TABLE content_items_new_migration RENAME TO content_items`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_content_items_brand ON content_items(brand_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_content_items_assignee ON content_items(assignee_id)`);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

// content_items tablosu, marka arşivleme desenine paralel bir "arşivle" alanından
// önce kurulmuş olabilir. Bu sütunun CHECK kısıtlaması yok, bu yüzden (yukarıdaki
// tabloları yeniden kuran migration'ların aksine) doğrudan ALTER TABLE ADD COLUMN
// yeterli — SQLite bunu CHECK'siz sütunlarda destekliyor.
function migrateContentItemsArchivedIfNeeded(db: DatabaseSync): void {
  const row = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='content_items'`)
    .get() as { sql: string } | undefined;
  if (!row || row.sql.includes("archived")) return;
  db.exec(`ALTER TABLE content_items ADD COLUMN archived INTEGER NOT NULL DEFAULT 0`);
}

// Post ve Story mevcut CHECK listesine sonradan eklendi. SQLite bir CHECK
// kısıtını ALTER COLUMN ile değiştiremediği için tabloyu bütün güncel alanlarıyla
// yeniden kuruyoruz. assignee_id ve archived özellikle kopyalanır: eski Carousel
// migration'ı bu alanlardan önce yazılmıştı ve güncel tabloya uygulanırsa veri
// kaybına yol açardı.
function migrateContentItemTypesIfNeeded(db: DatabaseSync): void {
  const row = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='content_items'`)
    .get() as { sql: string } | undefined;
  if (!row || (row.sql.includes("'Post'") && row.sql.includes("'Story'"))) return;

  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.exec("BEGIN");
    db.exec(`
      CREATE TABLE content_items_new_types_migration (
        id          TEXT PRIMARY KEY,
        brand_id    TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
        title       TEXT NOT NULL,
        type        TEXT NOT NULL CHECK (type IN ('Reel','Post','Story','Foto','Kampanya','Video','Carousel','KurumsalKimlik','Diger')),
        target_date TEXT,
        status      TEXT NOT NULL DEFAULT 'Planlandi' CHECK (status IN ('Planlandi','Uretimde','Tamamlandi','IptalEdildi')),
        assignee_id TEXT REFERENCES people(id) ON DELETE SET NULL,
        archived    INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec(`
      INSERT INTO content_items_new_types_migration
        (id, brand_id, title, type, target_date, status, assignee_id, archived, created_at, updated_at)
      SELECT id, brand_id, title, type, target_date, status, assignee_id, archived, created_at, updated_at
      FROM content_items
    `);
    db.exec(`DROP TABLE content_items`);
    db.exec(`ALTER TABLE content_items_new_types_migration RENAME TO content_items`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_content_items_brand ON content_items(brand_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_content_items_assignee ON content_items(assignee_id)`);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

// tasks tablosu priority sütunundan önce kurulmuş olabilir — aynı "yeni tabloyu
// geçici isimle kur, veriyi kopyala (priority='Normal' ile), eskiyi sil, yeniyi
// doğru isme çevir" deseni (bkz. migrateBrandsTableIfNeeded). comments tablosunun
// task_id FK'si etkilenmez çünkü tasks adı hiç değişmeden kalıyor.
function migrateTasksTableIfNeeded(db: DatabaseSync): void {
  const row = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'`)
    .get() as { sql: string } | undefined;
  if (!row || row.sql.includes("'Acil'")) return;

  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.exec("BEGIN");
    db.exec(`
      CREATE TABLE tasks_new_migration (
        id              TEXT PRIMARY KEY,
        content_item_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
        title           TEXT NOT NULL,
        status          TEXT NOT NULL DEFAULT 'Beklemede' CHECK (status IN ('Beklemede','DevamEdiyor','Incelemede','Onaylandi','Yayinlandi')),
        priority        TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Dusuk','Normal','Yuksek','Acil')),
        assignee_id     TEXT REFERENCES people(id) ON DELETE SET NULL,
        due_date        TEXT,
        notes           TEXT,
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec(`
      INSERT INTO tasks_new_migration
        (id, content_item_id, title, status, priority, assignee_id, due_date, notes, created_at, updated_at)
      SELECT id, content_item_id, title, status, 'Normal', assignee_id, due_date, notes, created_at, updated_at
      FROM tasks
    `);
    db.exec(`DROP TABLE tasks`);
    db.exec(`ALTER TABLE tasks_new_migration RENAME TO tasks`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_content_item ON tasks(content_item_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)`);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

// social_posts eskiden UNIQUE(platform, external_id) idi. Ortak gönderi
// (collab) paylaşan iki markadan ikincisinin satırı bu kısıt yüzünden
// sessizce düşüyordu (INSERT OR IGNORE aynı external_id'yi zaten görmüş
// sayıyordu) — o marka gerçekte paylaşım yapmışken sistemde "sessiz"
// görünüyordu. UNIQUE artık (brand_id, platform, external_id): aynı gönderi
// iki markaya da ayrı ayrı sayılabilir, aynı marka için tekrar hâlâ
// engellenir. Rebuild deseni diğer migration'larla aynı (bkz.
// migrateContentItemsTableIfNeeded) — SQLite ALTER ile inline UNIQUE
// değiştirilemiyor.
function migrateSocialPostsUniqueIfNeeded(db: DatabaseSync): void {
  const row = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='social_posts'`)
    .get() as { sql: string } | undefined;
  if (!row || row.sql.includes("UNIQUE (brand_id, platform, external_id)")) return;

  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.exec("BEGIN");
    db.exec(`
      CREATE TABLE social_posts_new_migration (
        id          TEXT PRIMARY KEY,
        brand_id    TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
        platform    TEXT NOT NULL DEFAULT 'instagram',
        external_id TEXT NOT NULL,
        permalink   TEXT,
        media_type  TEXT,
        caption     TEXT,
        posted_at   TEXT NOT NULL,
        fetched_at  TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (brand_id, platform, external_id)
      )
    `);
    db.exec(`
      INSERT INTO social_posts_new_migration
        (id, brand_id, platform, external_id, permalink, media_type, caption, posted_at, fetched_at)
      SELECT id, brand_id, platform, external_id, permalink, media_type, caption, posted_at, fetched_at
      FROM social_posts
    `);
    db.exec(`DROP TABLE social_posts`);
    db.exec(`ALTER TABLE social_posts_new_migration RENAME TO social_posts`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_social_posts_brand ON social_posts(brand_id, posted_at)`);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

export function getDb(): DatabaseSync {
  if (!globalThis.__inturlamDb) {
    globalThis.__inturlamDb = createConnection();
  }
  return globalThis.__inturlamDb;
}

// node:sqlite satırları null-prototype obje döner; React bunları Client
// Component'lere geçiremiyor. Düz objeye çevirerek her yerde güvenli kılıyoruz.
export function plainList<T>(rows: unknown[]): T[] {
  return rows.map((r) => ({ ...(r as Record<string, unknown>) }) as T);
}

export function plainOne<T>(row: unknown): T | undefined {
  return row == null
    ? undefined
    : ({ ...(row as Record<string, unknown>) } as T);
}
