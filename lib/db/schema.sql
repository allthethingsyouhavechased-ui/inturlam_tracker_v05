-- Marka kategorileri (küme). Kullanıcı arayüzden yeni kategori ekleyebildiği
-- için sabit listede değil, tabloda tutuluyor. brands.cluster bu tablonun id'sini
-- taşır ama bilinçli olarak FK YOK: kategori silinse bile marka kaydı düşmesin,
-- gruplanamayan markalar "Kategorisiz" başlığı altında görünsün istiyoruz.
CREATE TABLE IF NOT EXISTS clusters (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS brands (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  cluster    TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  accent_hue INTEGER NOT NULL DEFAULT 210 CHECK (accent_hue BETWEEN 15 AND 329),
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
  tier               TEXT,
  -- Takipçi/gönderi sayılarının son tazelenme tarihi (YYYY-MM-DD). Sayılar
  -- haftalık elle giriliyor; bu damga rakamın ne kadar bayat olduğunu gösterir.
  stats_updated_at   TEXT,
  -- Markanın sözleşmesindeki aylık çekim kotası. NULL = henüz tanımlanmadı.
  monthly_shoot_allowance INTEGER CHECK (monthly_shoot_allowance >= 0),
  -- Yıllık toplam çekim kotası; aylık haktan bağımsız sözleşme alanı.
  annual_shoot_allowance INTEGER CHECK (annual_shoot_allowance >= 0)
);

-- Bir dönemde KULLANILMIŞ çekim sayısının elle girilmiş değeri. Varsayılan
-- kaynak takvimdeki 'Cekim' etkinlikleridir; bu tablo yalnızca o sayımın
-- gerçeği yansıtmadığı dönemler için bir ÜSTÜNE YAZMA kaydı tutar (satır yoksa
-- takvim sayısı gösterilir, bkz. resolveShootUsage). `period` aylık hak için
-- 'YYYY-MM', yıllık hak için 'YYYY' — aylık kota her ay sıfırlandığı için tek
-- bir marka sütunu olamaz.
CREATE TABLE IF NOT EXISTS brand_shoot_usage (
  brand_id   TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  period     TEXT NOT NULL,
  used_count INTEGER NOT NULL CHECK (used_count >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (brand_id, period)
);

CREATE TABLE IF NOT EXISTS brand_relations (
  id               TEXT PRIMARY KEY,
  brand_id         TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  related_brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  relation_type    TEXT NOT NULL CHECK (relation_type IN
                     ('rakip','tedarikci','ortaklik_muhtemel','kismi_cakisma',
                      'portfoy_ici','marka_ailesi','kardes_sube','nuansli')),
  risk_level       TEXT CHECK (risk_level IN ('yuksek','dusuk','yok')),
  note             TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS brand_audits (
  brand_id      TEXT PRIMARY KEY REFERENCES brands(id) ON DELETE CASCADE,
  body_markdown TEXT NOT NULL,
  source_file   TEXT,
  audit_date    TEXT,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS people (
  id          TEXT PRIMARY KEY,
  -- Ekip girişinde yazılan ad. `id`'den AYRI: id onlarca tabloda FK olduğu için
  -- değiştirilemez, kullanıcı adı ise ekip yönetiminden düzeltilebilmeli.
  -- `accounts.username` DEĞİL: o sütun CHECK kısıtlamasıyla guest (marka)
  -- hesaplarına ayrılmış, ekip satırlarında NULL olmak zorunda.
  -- Küçük harfe indirgenmiş ASCII olarak saklanır (bkz. lib/username.ts).
  username    TEXT,
  name        TEXT NOT NULL,
  title       TEXT,
  bio         TEXT,
  avatar_path TEXT,
  -- Ekip disiplini: lib/departments.ts'teki DEPARTMENTS id'lerinden biri.
  -- CHECK bilinçli olarak yok — yeni bir departman eklemek tablo yeniden
  -- kurmayı gerektirmesin; geçersiz/boş değerler arayüzde "Diğer" sayılır.
  department  TEXT,
  password_hash TEXT,
  is_manager  INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1
);

-- Ekip ve marka guest hesapları tek oturum altyapısında birleşir. Mevcut
-- people.password_hash sütunu v02 geri uyumluluğu için korunur; v03 okumaları
-- accounts.password_hash kullanır.
-- Kişisel hedef, atanmış görev toplamından bağımsız ve her ay için ayrıdır.
-- Mevcut veriye varsayılan hedef yazılmaz; yönetici açıkça belirler.
CREATE TABLE IF NOT EXISTS person_monthly_point_targets (
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (month GLOB '[1-9][0-9][0-9][0-9]-[0-1][0-9]' AND substr(month, 6, 2) BETWEEN '01' AND '12'),
  target_points INTEGER NOT NULL CHECK (typeof(target_points) = 'integer' AND target_points BETWEEN 1 AND 100000),
  updated_by TEXT REFERENCES people(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (person_id, month)
);

CREATE TABLE IF NOT EXISTS person_monthly_point_target_changes (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  previous_points INTEGER,
  target_points INTEGER NOT NULL,
  actor_id TEXT REFERENCES people(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_point_target_changes_month ON person_monthly_point_target_changes(month, created_at);

CREATE TABLE IF NOT EXISTS accounts (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL CHECK (kind IN ('team','guest')),
  person_id     TEXT UNIQUE REFERENCES people(id) ON DELETE CASCADE,
  brand_id      TEXT UNIQUE REFERENCES brands(id) ON DELETE CASCADE,
  username      TEXT UNIQUE COLLATE NOCASE,
  password_hash TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (kind = 'team' AND person_id IS NOT NULL AND brand_id IS NULL AND username IS NULL)
    OR
    (kind = 'guest' AND person_id IS NULL AND brand_id IS NOT NULL AND username IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS account_sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Kısmi UNIQUE: kullanıcı adı benzersiz olmalı ama NULL bırakılabilmeli
-- (kullanıcı adı henüz atanmamış eski kayıtlar).
CREATE UNIQUE INDEX IF NOT EXISTS idx_people_username
  ON people(username) WHERE username IS NOT NULL;

-- Başarısız giriş denemesi sayaçları. Süreç içi bir Map'ten buraya taşındı:
-- orada sunucu yeniden başlayınca sıfırlanıyor, birden fazla örnek/worker
-- arkasında da paylaşılmıyordu. `attempt_key` ekip girişinde `team:<id>`,
-- guest girişinde `guest:<kullanıcı adı>` — bkz. lib/actions/identity.ts.
-- Zamanlar epoch MİLİSANİYE (LoginThrottle ms ile çalışıyor).
CREATE TABLE IF NOT EXISTS login_attempts (
  attempt_key   TEXT PRIMARY KEY,
  failures      INTEGER NOT NULL DEFAULT 0,
  started_at    INTEGER NOT NULL,
  blocked_until INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_started ON login_attempts(started_at);

-- Ekip içi görsel sorumluluk listesi; erişim kısıtı değildir.
CREATE TABLE IF NOT EXISTS person_brand_assignments (
  person_id  TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  brand_id   TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  assigned_by TEXT REFERENCES people(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (person_id, brand_id)
);

-- Tarayıcı yalnızca rastgele oturum anahtarını taşır; kişi kimliği veya rol
-- bilgisi cookie'ye güvenilerek belirlenmez. Token'in kendisi de DB'ye yazılmaz,
-- yalnızca SHA-256 özeti tutulur.
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  person_id  TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_person ON auth_sessions(person_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);

-- Ekipte kimin şu anda hangi marka üzerinde çalıştığı. Kişi başına tek seçim
-- tutulur; değişiklik yeni satır biriktirmek yerine güncel durumu temsil eder.
CREATE TABLE IF NOT EXISTS person_active_work (
  person_id  TEXT PRIMARY KEY REFERENCES people(id) ON DELETE CASCADE,
  brand_id   TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS content_items (
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
);

CREATE TABLE IF NOT EXISTS tasks (
  id              TEXT PRIMARY KEY,
  content_item_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'Beklemede' CHECK (status IN ('Beklemede','DevamEdiyor','Incelemede','Onaylandi','Yayinlandi')),
  priority        TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Dusuk','Normal','Yuksek','Acil')),
  -- NULL yalnızca migration öncesi görevler ve henüz ekipçe planlanmamış guest
  -- talepleri içindir. Yeni ekip görevleri uygulama katmanında seçim ister.
  difficulty      TEXT CHECK (difficulty IN ('Kolay','Orta','Zor','Ozel')),
  type_override   TEXT CHECK (type_override IN ('Reel','Post','Story','Foto','Kampanya','Video','Carousel','KurumsalKimlik','Diger')),
  assignee_id     TEXT REFERENCES people(id) ON DELETE SET NULL,
  due_date        TEXT,
  notes           TEXT,
  weight_points   INTEGER NOT NULL DEFAULT 1 CHECK (weight_points BETWEEN 1 AND 100),
  origin          TEXT NOT NULL DEFAULT 'team' CHECK (origin IN ('team','guest')),
  requested_date  TEXT,
  guest_brief     TEXT,
  created_by_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  -- Tekrar eden görev: kaç günde bir. NULL/0 = tekrar yok. Görev "Yayınlandı"
  -- durumuna alınınca bir sonraki örneği otomatik açılır (lib/actions/tasks.ts).
  repeat_days     INTEGER,
  -- Raporlama için gerçek tamamlanma bilgisi. Eski DB'lerde migration,
  -- yayınlanmış görevlerin updated_at değerini başlangıç olarak kullanır.
  completed_at    TEXT,
  completed_by    TEXT REFERENCES people(id) ON DELETE SET NULL,
  -- Arşivlenme damgası. NULL = pano/listelerde görünür. "Yayınlandı" bir görevi
  -- ANINDA gizlemez; yalnızca tamamlanmasının üzerinden ARCHIVE_AFTER_DAYS geçen
  -- (ya da elle arşivlenen) görev buradan damgalanıp panodan çekilir — yanlışlıkla
  -- yayınlandı işaretlenen iş kaybolmuş gibi görünmesin (lib/taskArchive.ts).
  archived_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Müşteriden gelen iş, gerçek göreve dönüşmeden önce bu kuyrukta değerlendirilir.
-- Talep onaylandığında `converted_task_id` doldurulur; özgün brief ve karar geçmişi
-- kaybolmaz. Yetki kuralları lib/requestAccess.ts ve Server Action katmanındadır.
CREATE TABLE IF NOT EXISTS client_requests (
  id                TEXT PRIMARY KEY,
  brand_id          TEXT NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  requested_by_name TEXT,
  source            TEXT,
  reference_url     TEXT,
  department        TEXT NOT NULL,
  content_type      TEXT NOT NULL DEFAULT 'Diger',
  status            TEXT NOT NULL DEFAULT 'Beklemede'
                    CHECK (status IN ('Beklemede','Incelemede','Onaylandi','Reddedildi')),
  priority          TEXT NOT NULL DEFAULT 'Normal'
                    CHECK (priority IN ('Dusuk','Normal','Yuksek','Acil')),
  assignee_id       TEXT REFERENCES people(id) ON DELETE SET NULL,
  due_date          TEXT,
  created_by_id     TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  reviewed_by_id    TEXT REFERENCES people(id) ON DELETE SET NULL,
  converted_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  reviewed_at       TEXT,
  archived_at       TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS client_request_comments (
  id         TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES client_requests(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS client_request_attachments (
  id            TEXT PRIMARY KEY,
  request_id    TEXT NOT NULL REFERENCES client_requests(id) ON DELETE CASCADE,
  file_path     TEXT NOT NULL,
  original_name TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Resmi teslim tarihinden bağımsız kişisel çalışma hedefi. Kişi bazlı ayrı
-- tabloda tutulur: görev başka birine geçtiğinde hedef yeni sahibine taşınmaz.
CREATE TABLE IF NOT EXISTS task_personal_targets (
  task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  person_id   TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  target_date TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (task_id, person_id)
);

-- Durumların ne zaman değiştiğini append-only saklar. Böylece yalnızca son
-- durumu değil, işin hangi aşamada ne kadar beklediğini de ileride ölçebiliriz.
CREATE TABLE IF NOT EXISTS task_status_events (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL,
  to_status   TEXT NOT NULL,
  actor_id    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Görev şablonları: aynı iş akışı (Reel → brief/çekim/kurgu/kapak/yayın) her
-- içerik için elle yazılmasın. Kategoriler gibi bunlar da kullanıcı tarafından
-- yönetiliyor, sabit listede değil.
CREATE TABLE IF NOT EXISTS task_templates (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  -- Hangi içerik türünde önerilecek. NULL = her tür.
  content_type TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS task_template_items (
  id              TEXT PRIMARY KEY,
  template_id     TEXT NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  priority        TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Dusuk','Normal','Yuksek','Acil')),
  difficulty      TEXT NOT NULL DEFAULT 'Orta' CHECK (difficulty IN ('Kolay','Orta','Zor','Ozel')),
  assignee_id     TEXT REFERENCES people(id) ON DELETE SET NULL,
  -- İçeriğin target_date'ine göre gün kayması: -3 = teslimden 3 gün önce.
  -- Eski NULL kayıtlar uygulamada 0 (teslim günü) olarak yorumlanır.
  due_offset_days INTEGER,
  sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS comments (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comment_attachments (
  id            TEXT PRIMARY KEY,
  comment_id    TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  file_path     TEXT NOT NULL,
  original_name TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Görevin "Notlar" alanına eklenen görseller — comment_attachments ile aynı
-- desen, ama comments'e değil doğrudan tasks'e bağlı (not, yorumdan bağımsız
-- bir alan).
CREATE TABLE IF NOT EXISTS task_attachments (
  id            TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_path     TEXT NOT NULL,
  original_name TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Revize turu görev durumundan bağımsızdır: bir iş İncelemede veya Devam Ediyor
-- durumundayken revize alabilir. Geçmiş append-only tutulur; sayaç elle ezilmez.
CREATE TABLE IF NOT EXISTS task_revision_rounds (
  id              TEXT PRIMARY KEY,
  task_id         TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  round_number    INTEGER NOT NULL CHECK (round_number > 0),
  target_minutes  INTEGER NOT NULL CHECK (target_minutes BETWEEN 15 AND 10080),
  note            TEXT,
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at    TEXT,
  created_by      TEXT REFERENCES people(id) ON DELETE SET NULL,
  completed_by    TEXT REFERENCES people(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (task_id, round_number)
);

-- Görev teslimleri append-only sürüm zinciridir. Her gönderim otomatik V1, V2...
-- numarası alır; karar mevcut satırda yalnızca bir kez mühürlenir. Büyük yaratıcı
-- dosyalar external_url ile, hızlı görsel kontrolü küçük önizleme ekleriyle taşınır.
CREATE TABLE IF NOT EXISTS task_deliveries (
  id                       TEXT PRIMARY KEY,
  task_id                  TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  version_number           INTEGER NOT NULL CHECK (version_number > 0),
  note                     TEXT,
  external_url             TEXT,
  guest_visible            INTEGER NOT NULL DEFAULT 0 CHECK (guest_visible IN (0,1)),
  status                   TEXT NOT NULL DEFAULT 'Beklemede'
                           CHECK (status IN ('Beklemede','Onaylandi','RevizeIstendi')),
  submitted_by_account_id  TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  submitted_by_name        TEXT NOT NULL,
  submitted_at             TEXT NOT NULL DEFAULT (datetime('now')),
  decision_actor_kind      TEXT CHECK (decision_actor_kind IN ('team','guest')),
  decided_by_account_id    TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  decided_by_name          TEXT,
  decision_note            TEXT,
  revision_reason          TEXT CHECK (revision_reason IN
                           ('BriefDegisikligi','MusteriDegisikligi','Tasarim','Metin','Teknik','Diger')),
  decided_at               TEXT,
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (task_id, version_number),
  CHECK (
    (status = 'Beklemede' AND decision_actor_kind IS NULL AND decided_by_name IS NULL
      AND decision_note IS NULL AND revision_reason IS NULL AND decided_at IS NULL)
    OR
    (status = 'Onaylandi' AND decision_actor_kind IS NOT NULL AND decided_by_name IS NOT NULL
      AND revision_reason IS NULL AND decided_at IS NOT NULL)
    OR
    (status = 'RevizeIstendi' AND decision_actor_kind IS NOT NULL AND decided_by_name IS NOT NULL
      AND decision_note IS NOT NULL AND revision_reason IS NOT NULL AND decided_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS task_delivery_attachments (
  id            TEXT PRIMARY KEY,
  delivery_id   TEXT NOT NULL REFERENCES task_deliveries(id) ON DELETE CASCADE,
  file_path     TEXT NOT NULL,
  original_name TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Guest ile paylaşılan konuşmalar iç yorumlardan fiziksel olarak ayrıdır;
-- böylece bir DTO/filtre hatası iç notları dışarı sızdıramaz.
CREATE TABLE IF NOT EXISTS task_shared_comments (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  author_name TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS task_shared_attachments (
  id            TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  file_path     TEXT NOT NULL,
  original_name TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Marka bazlı veya ofis genelindeki yaratıcı/operasyonel fikirlerin aranabilir bankası.
-- Marka adı snapshot olarak da tutulur; marka sonradan silinse bile fikrin bağlamı kaybolmaz.
CREATE TABLE IF NOT EXISTS ideas (
  id                  TEXT PRIMARY KEY,
  scope_type          TEXT NOT NULL CHECK (scope_type IN ('office','brand')),
  brand_id            TEXT REFERENCES brands(id) ON DELETE SET NULL,
  brand_name_snapshot TEXT,
  category            TEXT NOT NULL CHECK (category IN ('Icerik','Kampanya','Gorsel','Strateji','Ofis','Diger')),
  status              TEXT NOT NULL DEFAULT 'Yeni'
                      CHECK (status IN ('Yeni','Gelistiriliyor','Hazir','Kullanildi')),
  title               TEXT NOT NULL,
  body                TEXT NOT NULL,
  source_url          TEXT,
  source_platform     TEXT CHECK (source_platform IN ('Instagram','TikTok','Pinterest','YouTube','Web')),
  tags_text           TEXT,
  created_by_id       TEXT REFERENCES people(id) ON DELETE SET NULL,
  created_by_name     TEXT NOT NULL,
  archived_at         TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id                TEXT PRIMARY KEY,
  brand_id          TEXT REFERENCES brands(id) ON DELETE SET NULL,
  type              TEXT NOT NULL DEFAULT 'Toplanti' CHECK (type IN ('Toplanti','Cekim','Diger')),
  color_key         TEXT NOT NULL DEFAULT 'auto' CHECK (color_key IN ('auto','lavender','sage','purple','coral','amber','orange','cyan','slate','blue','green','rose')),
  title             TEXT NOT NULL,
  description       TEXT,
  start_at          TEXT NOT NULL,
  end_at            TEXT NOT NULL,
  all_day           INTEGER NOT NULL DEFAULT 0,
  location          TEXT,
  guest_visible     INTEGER NOT NULL DEFAULT 0,
  google_event_id   TEXT UNIQUE,
  google_etag       TEXT,
  google_updated_at TEXT,
  sync_status       TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','error')),
  sync_error        TEXT,
  deleted_at        TEXT,
  created_by_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  last_synced_at    TEXT
);

-- Toplantı ve çekimlerin ekip içi sonuç kaydı. Etkinlikten ayrı tutulur; böylece
-- guest takvim DTO'su yalnızca paylaşılan takvim alanlarını taşımaya devam eder.
CREATE TABLE IF NOT EXISTS calendar_event_reports (
  event_id       TEXT PRIMARY KEY REFERENCES calendar_events(id) ON DELETE CASCADE,
  participants   TEXT,
  summary        TEXT,
  decisions      TEXT,
  next_steps     TEXT,
  updated_by_id  TEXT REFERENCES people(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS calendar_sync_state (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Aktivite geçmişi: kim, ne zaman, hangi varlıkta ne yaptı. Denetlenebilirlik
-- için append-only. actor_name/entity bilgileri anlık (snapshot) tutulur ki
-- kişi/varlık sonradan silinse bile kayıt okunabilir kalsın — bu yüzden FK yok.
CREATE TABLE IF NOT EXISTS activity_log (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT,
  actor_name  TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  brand_id    TEXT,
  summary     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- @mention bildirimleri: bir yorumda @İsim ile bahsedilen kişiye. activity_log
-- ile aynı gerekçeyle (yukarıya bak) actor/recipient/task/brand bilgisi anlık
-- (snapshot) metin/id olarak tutulur, FK YOK — kişi ya da görev sonradan
-- silinse bile bildirim geçmişi okunabilir kalsın.
CREATE TABLE IF NOT EXISTS notifications (
  id             TEXT PRIMARY KEY,
  recipient_id   TEXT NOT NULL,
  recipient_name TEXT,
  actor_id       TEXT,
  actor_name     TEXT,
  task_id        TEXT,
  calendar_event_id TEXT,
  brand_id       TEXT,
  summary        TEXT NOT NULL,
  read           INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ————————————————————————————————————————————————————————————————————————
-- Sosyal medya takibi (Instagram). Markaların hesapları günlük taranır; belirli
-- bir süre paylaşım yapılmayan hesaplar bildirilir. Veri kaynağı takılabilir
-- (bkz. lib/social/), şu an Apify'ın instagram-post-scraper aktörü.
-- ————————————————————————————————————————————————————————————————————————

-- Taramada görülen gönderiler. Sağlayıcı aynı gönderiyi her taramada tekrar
-- döndürdüğü için (platform, external_id) tekil: yeniden yazmak yerine
-- yok sayılır, "yeni gönderi" sayısı böylece gerçekten yeni olanı sayar.
CREATE TABLE IF NOT EXISTS social_posts (
  id          TEXT PRIMARY KEY,
  brand_id    TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL DEFAULT 'instagram',
  external_id TEXT NOT NULL,
  permalink   TEXT,
  media_type  TEXT,
  caption     TEXT,
  -- Gönderinin yayın anı, ISO 8601 (UTC). Sıralama/karşılaştırma metin olarak
  -- doğru çalışsın diye hep aynı biçimde yazılır.
  posted_at   TEXT NOT NULL,
  fetched_at  TEXT NOT NULL DEFAULT (datetime('now')),
  -- brand_id dahil: aynı gönderi PORTFÖYDEKİ İKİ FARKLI markayı etiketleyen
  -- bir ortak gönderi (collab) olabilir — o zaman iki markanın da kendi satırı
  -- olmalı. Yalnızca (platform, external_id) olsaydı ikinci markanın satırı
  -- INSERT OR IGNORE ile sessizce düşerdi (bkz. migrateSocialPostsUniqueIfNeeded).
  UNIQUE (brand_id, platform, external_id)
);

-- Her tarama çalıştırması. "Hesapta paylaşım yok" ile "veriyi çekemedik"
-- ekranda ayrılabilsin diye şart: sessizlik uyarısı yalnızca BAŞARILI bir
-- taramanın ardından anlamlıdır.
CREATE TABLE IF NOT EXISTS social_sync_runs (
  id          TEXT PRIMARY KEY,
  provider    TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('running','ok','error')),
  accounts    INTEGER NOT NULL DEFAULT 0,
  new_posts   INTEGER NOT NULL DEFAULT 0,
  error       TEXT,
  started_at  TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);

-- Marka bazında en son bilinen durum. social_posts'tan türetilebilir ama
-- ayrıca tutuluyor: hesap hiç gönderi döndürmediğinde de "en son ne zaman
-- baktık, hata mı aldık, en son ne zaman uyardık" bilgisi gerekiyor.
CREATE TABLE IF NOT EXISTS brand_social_state (
  brand_id        TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL DEFAULT 'instagram',
  handle          TEXT,
  last_post_at    TEXT,
  last_checked_at TEXT,
  last_status     TEXT CHECK (last_status IN ('ok','error')),
  last_error      TEXT,
  -- Sessizlik bildirimi en son ne zaman gönderildi. Her taramada aynı marka
  -- için tekrar tekrar bildirim üretilmesini engeller.
  alerted_at      TEXT,
  PRIMARY KEY (brand_id, platform)
);

-- ————————————————————————————————————————————————————————————————————————
-- Sosyal medya üretim planı: aylık hedefler, elde hazır bekleyen varlık
-- sayısı, haftalık paylaşım takvimi. Yukarıdaki "takip" bloğundan (Instagram
-- taraması) bağımsız — bu üçü tamamen elle girilir.
-- ————————————————————————————————————————————————————————————————————————

-- Marka başına AYLIK üretim hedefi (ör. 15 Post / 15 Story / 4 Reels).
-- Aya göre DEĞİŞMEZ: tek sabit hedef, her ay geçerli (kullanıcı kararı,
-- 2026-08). `kind` üzerinde CHECK YOK — yeni kategori eklemek CHECK
-- genişletmeyi, o da tabloyu yeniden kurmayı gerektirirdi. Geçerlilik
-- lib/socialPlan.ts'teki CONTENT_KINDS ile action'da doğrulanır
-- (people.department ile aynı gerekçe, bkz. migratePeopleDepartmentIfNeeded
-- yorumu).
CREATE TABLE IF NOT EXISTS brand_content_targets (
  brand_id       TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL,
  monthly_target INTEGER NOT NULL DEFAULT 0,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (brand_id, kind)
);

-- Elde yayına HAZIR bekleyen varlık sayısı — canlı STOK, ay bazlı değil.
-- Bu yüzden `month` sütunu yok ve geçmiş ay geçmişi tutulmuyor (kullanıcı
-- kararı). ÖNEMLİ: content_items'tan TÜRETİLMEZ, elle girilir. content_items
-- bir PROJE kaydıdır (bir projede birden çok varlık olabilir), varlık
-- sayacı değildir — "otomatik hesaplayalım" diye ikisini birleştirme.
CREATE TABLE IF NOT EXISTS brand_asset_counts (
  brand_id    TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  ready_count INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (brand_id, kind)
);

-- Aylık üretimin teslim edildiğine dair kapanış işareti. Hazır varlık sayısı
-- canlı stoktur ve paylaşımlar oldukça azalabilir; bu kayıt o sayaçtan
-- bağımsız olarak ilgili ayın teslim kararını korur.
CREATE TABLE IF NOT EXISTS brand_monthly_content_completions (
  brand_id    TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  month       TEXT NOT NULL,
  completed_by TEXT REFERENCES people(id) ON DELETE SET NULL,
  completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (brand_id, month)
);

-- Paylaşım takvimi: marka × GÜN → o gün planlanan kombinasyon ("Post+Story").
-- Hücre sabit bir açılır listeden seçildiği için tek TEXT sütun yeterli; tür
-- bazlı sayım lib/socialPlan.ts'teki COMBO_KINDS haritasıyla JS'te çözülür.
-- Boş seçim satırı SİLER (combo = '' yazmaz) — bkz. setBrandPlanEntry.
CREATE TABLE IF NOT EXISTS brand_plan_entries (
  brand_id   TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  plan_date  TEXT NOT NULL,               -- 'YYYY-MM-DD'
  combo      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (brand_id, plan_date)
);

CREATE INDEX IF NOT EXISTS idx_social_posts_brand ON social_posts(brand_id, posted_at);
CREATE INDEX IF NOT EXISTS idx_brand_plan_entries_date ON brand_plan_entries(plan_date);
CREATE INDEX IF NOT EXISTS idx_brands_cluster      ON brands(cluster);
CREATE INDEX IF NOT EXISTS idx_clusters_sort       ON clusters(sort_order);
CREATE INDEX IF NOT EXISTS idx_person_active_work_brand ON person_active_work(brand_id);
CREATE INDEX IF NOT EXISTS idx_accounts_person ON accounts(person_id);
CREATE INDEX IF NOT EXISTS idx_accounts_brand ON accounts(brand_id);
CREATE INDEX IF NOT EXISTS idx_account_sessions_account ON account_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_account_sessions_expiry ON account_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_person_brand_assignments_brand ON person_brand_assignments(brand_id);
CREATE INDEX IF NOT EXISTS idx_content_items_brand    ON content_items(brand_id);
CREATE INDEX IF NOT EXISTS idx_content_items_assignee ON content_items(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_content_item  ON tasks(content_item_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee      ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date      ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_difficulty    ON tasks(difficulty);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at  ON tasks(completed_at);
CREATE INDEX IF NOT EXISTS idx_tasks_archived_at   ON tasks(archived_at);
CREATE INDEX IF NOT EXISTS idx_client_requests_status
  ON client_requests(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_client_requests_creator
  ON client_requests(created_by_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_client_requests_department
  ON client_requests(department, status);
CREATE INDEX IF NOT EXISTS idx_client_requests_archive
  ON client_requests(archived_at, reviewed_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_requests_converted_task
  ON client_requests(converted_task_id) WHERE converted_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_request_attachments_request
  ON client_request_attachments(request_id, created_at);
CREATE INDEX IF NOT EXISTS idx_client_request_comments_request
  ON client_request_comments(request_id, created_at);
CREATE INDEX IF NOT EXISTS idx_personal_targets_person
  ON task_personal_targets(person_id, target_date);
CREATE INDEX IF NOT EXISTS idx_task_status_events_task
  ON task_status_events(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_task_revision_rounds_task
  ON task_revision_rounds(task_id, round_number DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_revision_rounds_active
  ON task_revision_rounds(task_id) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_deliveries_task
  ON task_deliveries(task_id, version_number DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_deliveries_pending
  ON task_deliveries(task_id) WHERE status = 'Beklemede';
CREATE INDEX IF NOT EXISTS idx_task_delivery_attachments_delivery
  ON task_delivery_attachments(delivery_id);
CREATE INDEX IF NOT EXISTS idx_comments_task       ON comments(task_id);
CREATE INDEX IF NOT EXISTS idx_template_items_template ON task_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_comment_attachments_comment ON comment_attachments(comment_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_shared_comments_task ON task_shared_comments(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_task_shared_attachments_task ON task_shared_attachments(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ideas_scope ON ideas(scope_type, brand_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ideas_category ON ideas(category, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_calendar_events_range ON calendar_events(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_brand ON calendar_events(brand_id, start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_sync ON calendar_events(sync_status, updated_at);
CREATE INDEX IF NOT EXISTS idx_brand_relations_brand   ON brand_relations(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_relations_related ON brand_relations(related_brand_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_brand   ON activity_log(brand_id);
CREATE INDEX IF NOT EXISTS idx_activity_entity  ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON notifications(recipient_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created        ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_calendar_event ON notifications(calendar_event_id);
