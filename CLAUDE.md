@AGENTS.md

# İNTURLAM İş Takip — proje notları

İNTURLAM'ın 19 markası için içerik & görev takip aracı + marka araştırma verisi.
Marka → İçerik → Görev (+yorum). Markalar kullanıcı tarafından yönetilen
kategorilere (`clusters` tablosu) ayrılır. Her markanın ayrıca Instagram araştırma verisi
(takipçi, performans, bulgular, tam denetim metni, diğer markalarla ilişkisi) var.
İç araç, LAN'da çalışır. Kişi adına tıklayıp şifreyle giriş yapılır; raporlar
yalnızca `people.is_manager = 1` olan yöneticilere açıktır.
Yönetici rolünü verme/kaldırma yetkisi şimdilik yalnız sabit `yunus` kişi id'sine
aittir (`lib/auth/authorization.ts`); arayüz kontrolüne güvenilmez, Server Action
aynı yetkiyi yeniden doğrular. Yunus kendi yönetici rolünü kaldıramaz.

## Stack

- Next.js 16 (App Router, Turbopack, Server Actions) + React 19 + Tailwind v4.
- Veritabanı: Node'un yerleşik **`node:sqlite`**'ı (harici paket/derleme yok). Tek dosya: `data/inturlam.db`.
- Tarih: `date-fns` (+ `tr` locale).

## Katmanlar

- `lib/db/client.ts` — `getDb()` singleton (globalThis, WAL + FK pragmas). Şemayı `lib/db/schema.sql`'den okur,
  ardından `migrateBrandsTableIfNeeded()` çalışır (aşağıya bak).
- `lib/repositories/*` — tüm SQL burada (senkron, prepared statements). `brands.ts`'te
  `listBrandRelations()` (karşı markanın bilgisini normalize eder) ve `getBrandAudit()` da var.
- `lib/actions/*` — `"use server"` mutasyonları; repo çağır + `revalidatePath("/", "layout")`.
- **Ekip kullanıcı adı `people.username`'de.** `accounts.username` DEĞİL: o sütunun CHECK'i
  ekip satırlarında NULL olmasını şart koşuyor, kullanıcı adı orada yalnız guest (marka)
  hesaplarına ait. `people.id` de kullanılamaz — onlarca tabloda FK, değiştirilemez. Biçim
  kuralları `lib/username.ts`'te (`normalizeUsername` — 3-32 karakter, yalnız ASCII
  harf/rakam/`.`/`_`/`-`, küçük harfe indirgenmiş). Türkçe harf BİLEREK dışarıda: "İ/ı"
  katlaması yerele göre değiştiği için benzersizlik kontrolü ortamdan ortama farklı sonuç
  verirdi. `findLoginCandidate` sırayla kullanıcı adı → id → tam ad dener. Ekip ve guest
  kullanıcı adları ayrı tablolarda ve ayrı giriş formlarından çözüldüğü için aralarındaki
  bir çakışma belirsizlik yaratmaz. `migratePeopleUsernameIfNeeded` sütunu eklerken id'si
  zaten insan-okunabilir olan kayıtları geri dolduruyor; UUID id'liler boş kalır.
- **Görev silme kuralı tek yerde: `canDeleteTasks()` (`lib/auth/authorization.ts`).** Sunucu
  tarafı guard'ı `requireManager()` (aynı `is_manager === 1` kuralı), arayüz tarafı bu
  yardımcıyı çağırıyor — sayfalarda `me.is_manager === 1` satır içi tekrarı yazma.
  `TaskListView`/`PanomViews`'un `canDeleteTasks` prop'u varsayılan `false`: yeni bir çağıran
  geçirmeyi unutursa düğme gizli kalır.
- **Oturum çerezinin `secure` bayrağı isteğin şemasından türetiliyor** (`lib/auth/cookieSecurity.ts`).
  Sabit `true` olsaydı LAN'daki düz HTTP dağıtımında hiç kimse giriş yapamazdı; hiç olmasaydı
  HTTPS arkasında token düz metin gidebilirdi. `x-forwarded-proto` okunur, `SESSION_COOKIE_SECURE`
  env'i ile her iki yönde elle ezilebilir. `next.config.ts`'teki HSTS başlığı düz HTTP'de
  tarayıcılarca zaten yok sayılır — LAN kullanımını bozmaz.
- **Dış bağlantılar `href`e girmeden ÖNCE `safeHttpUrl()` (`lib/urlSafety.ts`) ile şema
  doğrulamasından geçer.** Yalnız http/https; başka her şey `null` (bağlantı hiç verilmez).
  Apify'ın döndürdüğü `url` alanı hem yazılırken (`lib/social/apify.ts`) hem render edilirken
  (`app/social/takip/page.tsx`) süzülüyor. Yeni bir dış bağlantı alanı eklerken bu guard'ı da ekle.
- **Giriş deneme sayaçları `login_attempts` tablosunda, süreç belleğinde DEĞİL.** `LoginThrottle`
  bir `LoginAttemptStore` alıyor; üretimde `sqliteLoginAttemptStore()`, testlerde bellek store'u.
  Map'te tutulunca sunucu her yeniden başladığında sınır sıfırlanıyor ve ikinci bir örnek/worker
  aynı hesaba baştan 5 deneme tanıyordu. Ekip ve guest girişleri anahtarı `team:`/`guest:` ile
  önekliyor. Budama yazma yolunda ve eşiği `Date.now()` değil YAZILAN DENEMENİN damgasından
  alıyor — sınıf saati dışarıdan alabildiği için ikisi karışınca budama az önce yazılan satırı
  siliyordu.
- `lib/identity.ts` — HttpOnly `inturlam_v03_session` cookie'sindeki rastgele anahtarı
  `account_sessions` tablosunda doğrulayıp `TeamActor | GuestActor` kimliğini çözer.
  Cookie'de ham kişi/marka id'si veya rol tutulmaz. `lib/actions/identity.ts`
  ekip/guest girişini, çıkışı ve şifre değişimini yönetir;
  şifreler `lib/auth/password.ts` içinde salt'lı `scrypt` özeti olarak saklanır.
- Sayfalar `app/`, client component'ler `components/`.
- Seed: `db/seed.mts` (`npm run db:seed`) — 19 marka + kişiler + `brand_relations` + vault'taki
  tam denetim metinleri (`brand_audits`). Kişileri/marka adlarını buradan düzenle. `getDb()`'yi
  `lib/db/client.ts`'den import ediyor (bkz. "Node native TS import" tuzağı aşağıda) — kendi
  bağlantısını açmıyor, tek bootstrap noktası.
- Yedekleme: `db/backup.mts` (`npm run db:backup`, `predev`/`prestart` ile otomatik) ve
  `db/restore.mts` (`npm run db:restore`). Yedek `VACUUM INTO` ile alınır — sunucu DB'yi açık
  tutarken bile tutarlı; dosyayı elle kopyalamak `.db-wal`'daki son yazmaları kaçırır. İkisi de
  `getDb()` KULLANMAZ, kendi salt-okunur bağlantısını açar (yedek alırken migration çalışmasın).
- Şablonlar: `task_templates` + `task_template_items` (`lib/repositories/templates.ts`).
  `applyTemplateToContent()` tek transaction'da her satır için görev açar; tarih `shiftDate()` ile
  içeriğin `target_date`'ine `due_offset_days` eklenerek bulunur (UTC, ay sınırı güvenli).
  Varsayılan 3 şablon `seedTaskTemplatesIfNeeded()` ile **yalnızca tablo boşken** yazılır —
  `DEFAULT_CLUSTERS`'ın `INSERT OR IGNORE` deseninden bilinçli olarak farklı: kullanıcı bir şablonu
  silince her sunucu açılışında geri gelmesin diye.
- Görev arşivi: `tasks.archived_at` + `lib/taskArchive.ts`. "Yayınlandı" bir görev panodan
  ANINDA düşmez — `ARCHIVE_AFTER_DAYS` (7) gün sonra `sweepArchivablePublishedTasks()`
  damgalar. Süpürme cron değil: görev listeleyen `force-dynamic` sayfalar (`/`, `/tasks`,
  `/panom`, içerik detayı, rapor export'u) okumadan ÖNCE çağırır. Damga SİLME değil —
  rapor/takvim okumaya devam eder, `setTaskArchived(id, false)` geri alır. Yeni bir
  "yayınlananları da gösteren" sorgu yazarken `archived_at IS NULL` koşulunu EKLE
  (`NOT_ARCHIVED` sabiti); "açık iş" sorgularının buna ihtiyacı yok çünkü arşiv yalnızca
  yayınlanmış işlere konur. `applyTaskStatusChanges` HER durum değişikliğinde
  `archived_at`'i NULL'lar: arşivdeki iş yeniden açılınca görünmez kalmasın, yeniden
  yayınlanınca da hemen arşive düşmesin.
- Tekrar eden görev: `tasks.repeat_days`. `setTaskStatusAction` içinde durum `Yayinlandi` olunca
  `createNextOccurrence()` çağrılır; yeni görev `Beklemede` başladığı için dal tekrar tetiklenmez
  (sonsuz döngü yok). Yeni tarih **eski görevin `due_date`'ine** göre kayar, bugüne göre değil —
  geç kapatılan haftalık iş takvimi kaydırmasın.
- Migration'ı sunucuyu kapatmadan uygulama: `npm run db:migrate` (`db/migrate.mts`) sadece `getDb()`
  çağırır. Dev sunucusu DB'yi açık tutarken yeni tablo/sütun eklendiğinde onun eski bağlantısı
  tabloyu göremez ("no such table"); bu komut şemayı ayrı bir bağlantıdan uygular, SQLite değişikliği
  diğer bağlantılara yansıtır — sunucuyu yeniden başlatmaya gerek kalmaz.
- Departman: `people.department` (düz, nullable TEXT — CHECK/FK yok). Geçerli değerler
  `lib/departments.ts`'teki `DEPARTMENTS` id'leri; tanınmayan/boş değer arayüzde "Diğer"
  sayılır (`departmentKey()` / `departmentLabel()`). Kişileri gruplamak için
  `groupPeopleByDepartment()`, rapor satırlarını sabit sıraya dizip eksikleri sıfırlamak
  için `withAllDepartments()`. Departman GÖREVİN değil KİŞİNİN alanı: görev/rapor
  ekranlarındaki departman filtresi atanan üzerinden dolaylı çalışır, bu yüzden bir
  departman seçiliyken **atanmamış görevler listeden düşer**. SQL tarafındaki karşılığı
  `lib/repositories/people.ts`'te: `departmentPeopleCondition()` (görev sorgusunu
  departmana daraltan alt sorgu) ve `departmentBucketExpression()` (`people.department`
  → rapor kovası). İkisi de `DEPARTMENTS` id'lerini SQL'e gömer — kod sabiti, kullanıcı
  girdisi değil.
- Excel dökümü: `/reports/export` route handler → `lib/reportWorkbook.ts` (veri → sayfa) →
  `lib/xlsx.ts` (bağımlılıksız XLSX yazıcı, `node:zlib` ile elle ZIP). Rapor EKRANLARI
  yalnızca sayı gösteriyor; döküm ayrıca `listTaskDetailReport()` ile satır satır işleri
  taşır (ad, marka, KATEGORİ, içerik, sorumlu, tarihler). `lib/xlsx.ts` Server Action'dan
  değil route handler'dan çağrılır — `node:zlib` istemci paketine girmesin diye.
  Sayfa/hücre yapısı `tests/xlsx.test.ts`'te ZIP'i merkezi dizinden okuyarak (Excel'in
  izlediği yol) doğrulanıyor; offset hesabını değiştirirsen o test tutar.
- Raporlar üç kapsamda çalışır: `lib/repositories/reports.ts`'teki sayaç fonksiyonlarının
  hepsi isteğe bağlı bir `scope: ReportScope` parametresi alır. `null` → portföy geneli
  (`/reports`), kişi id'si (string) → tek kişi (`/reports/kisi/[personId]`),
  `{ department }` → tek departman (`/reports/departman/[departmentId]`). Aynı SQL'i
  ikinci kez yazma; yeni bir rapor sorgusu eklerken `scopeExpression()`/`scopeCondition()`/
  `scopeParams()` desenini kullan, yoksa kapsamlı rapor sessizce tüm ekibin sayılarını
  gösterir. Departman kapsamı `assignee_id` üzerinden dolaylı çalıştığı için
  **atanmamış görevler hiçbir departmanın sayısına girmez** — bilinçli.
  Rapor listelerinin görev tarafı (`gecikmiş/yaklaşan/son tamamlanan`) da aynı ikiliği
  taşır: `lib/repositories/tasks.ts`'teki `list*TasksByAssignee` / `list*TasksByDepartment`
  çiftleri tek bir özel `list*TasksForScope` gövdesini paylaşır.
- Üç rapor ekranının (portföy/kişi/departman) ortak yapı taşları
  `components/reports/ReportPrimitives.tsx`'te (`MetricCard`, `ShareBar`, `TaskRow`,
  `TaskListPanel`, `WorkflowBreakdownPanel`, `PriorityBreakdownPanel`,
  `BrandBreakdownPanel`, `formatRate`/`formatDays`/`comparePeriod`). `MetricCard` ve
  dağılım kartları bir dönem iki dosyada birebir kopyalanmıştı; yeni bir rapor ekranı
  yazarken üçüncü kopyayı üretme.
- Rapor kartları `components/reports/CollapsiblePanel.tsx` ile katlanıyor. Tercih
  `localStorage`'da (`inturlam.reportPanels`) ve **yalnızca KAPALI kartlar** saklanıyor:
  varsayılan açık durum depoda yer tutmasın ki sonradan eklenen bir kart eski kayıtla
  sessizce kapalı gelmesin. Depo okuması `useSyncExternalStore` ile (efekt + `setState`
  değil, bkz. Sidebar notu); sunucu anlık görüntüsü hep varsayılan olduğu için SSR
  çıktısı sabit, kapalı kartlar hydration'dan sonra kapanıyor. `panelKey` aynı olan
  kartlar tek tercihi paylaşır — kişi ve departman raporundaki eşdeğer kartlar bilinçli
  olarak `scope-*` anahtarlarını paylaşıyor.
- Instagram takibi: `lib/social/` (sağlayıcı adaptörleri) + `lib/repositories/social.ts` +
  `lib/socialSilence.ts` (saf kurallar) + `db/sync-instagram.mts` (`npm run social:sync`,
  Görev Zamanlayıcı'da günde 1 kez 09:00, görev adı "Inturlam Instagram Takip"). Veri kaynağı **takılabilir**: `SocialProvider`
  arayüzünü karşılayan adaptör (`apify` gerçek, `mock` test) `resolveSocialProvider()`
  ile seçilir — scraper sağlayıcıları kısa ömürlü olduğu için bu soyutlama isteğe
  bağlı değil. Taranacak liste ayrı tutulmaz, `brands.instagram_handle`'dan gelir. Uyarı alıcıları
  `listSocialAlertRecipients()`: aktif yöneticiler VE `department = 'social'` olanlar
  (tek `OR` sorgusu, ikisinde birden olan kimse iki bildirim almasın).
  **Sistemin taşıyıcı kuralı: başarısız tarama sessizlik uyarısı ÜRETMEZ.** Sağlayıcı
  patladığında her hesap "hiç paylaşım yok" gibi görünür; bu yüzden `classifySocial`
  hata durumunu son paylaşım tarihinin ÖNÜNE koyar ve `shouldAlertSilence` yalnızca
  `silent` için true döner. "Veri gelmiyor" ile "paylaşım yok" ekranda da ayrı
  renktedir (`SocialHealthBadge`) — ikisini birleştiren bir "sadeleştirme" yapma.
  Gün sayısı SQL'de değil `daysBetween` ile JS'te hesaplanır: julianday farkı (24 saatlik
  dilimler) ile takvim günü farkı ayrışıp rozet ile sınıflandırmayı çelişkiye düşürüyordu.
- Alias çözücü (`scripts/alias-hook.mjs` + `scripts/register.mjs`): `lib/*` modülleri
  birbirini `@/...` ile import ettiği için Node ile doğrudan çalışan her şey (testler VE
  `db/sync-instagram.mts` gibi CLI script'leri) `node --import ./scripts/register.mjs`
  ile başlatılmalı. Eskiden `tests/` altındaydı; ikinci kullanıcı çıkınca taşındı.
  `db/seed.mts` gibi eski script'ler hâlâ relative + açık `.ts` uzantısı kullanıyor,
  onlar hook'suz da çalışır.
- Demo veri: `db/seed-demo.mts` (`npm run db:seed:demo`) — uygulamayı elle gezerek test etmek için
  14 içerik + 41 görev + yorum + aktivite yazar. Tüm id'ler `demo-` ön ekli; script her çalıştığında
  önce bu kayıtları silip yeniden yazar (idempotent), `-- --clean` ile sadece siler. Gerçek veriye
  dokunmaz. Tarihler bugüne göre göreli üretilir, böylece "gecikmiş"/"bu hafta" panoları hep dolu.
  **`brand_content_targets`/`brand_asset_counts`/`brand_plan_entries` (aşağıya bak) BİLEREK bu
  script'e eklenmedi**: onlar `content_items` gibi id'li/eklemeli değil, `brands.follower_count`
  gibi marka başına TEK satır (`PRIMARY KEY (brand_id, kind)` vb.) — demo verisini `demo-%`
  deseniyle ayırt edip `--clean`'de silmenin bir yolu yok, o yüzden gerçek bir markanın hedefini
  demo satırıyla ezip sonra `--clean`'de sessizce silme riski var. Aynı sebeple bu üçü hiçbir
  zaman id'li bir tabloya dönüştürülüp "demo'ya da eklensin" diye genişletilmemeli.
- Sosyal medya üretim planı (Takip'ten AYRI): `/social` artık `app/social/layout.tsx` altında üç
  kardeş sayfa — `takip` (mevcut Instagram taraması, yukarıdaki madde), `varlik`, `takvim`.
  Üçü de `brand_content_targets`/`brand_asset_counts`/`brand_plan_entries`
  (`lib/repositories/socialPlan.ts`, `lib/actions/socialPlan.ts`) üzerinden okur/yazar — hepsi
  YENİ tablo, migration fonksiyonu YOK (`CREATE TABLE IF NOT EXISTS` yeterli). Sabitler/saf
  kurallar `lib/socialPlan.ts`'te (`"use client"` DEĞİL — hem action hem component okuyor,
  `BRAND_VIEW_COOKIE` tuzağıyla aynı gerekçe): `CONTENT_KINDS` (Post/Story/Reels — `ContentType`
  ile BİLEREK ayrı, proje türü değil üretim kategorisi), `PLAN_COMBOS` (takvim hücresindeki sabit
  10 kombinasyonluk açılır liste, LinkedIn YALNIZCA burada var), `countKindsInCombos`.
  **Hedefler markadan SABİT** (aya göre değişmez, marka sayfasından `BrandContentTargetsSection`
  ile girilir) — **varlık sayısı ise ay bazlı DEĞİL, sıfırlanmayan canlı STOK** (elle girilir,
  `content_items`'tan asla türetilmez — biri proje kaydı, öteki üretilmiş varlık sayacı, ikisini
  birleştirme). İkisi de ortak `components/CountStepper.tsx` (−/+ ve sayıya tıkla-yaz, 400ms
  debounce + mutlak değer yazar) ile düzenlenir. `app/social/takvim` haftaları
  `lib/date.ts`'teki `monthWeeks()` ile böler — `calendarGridDays()`'ten BİLEREK farklı bir kural
  ("bir ayın haftaları = Pazartesi'si o ayın içine düşen haftalar", 4-5 hafta, dolgu yok; takvim
  ızgarası sabit 6 satır/42 gün) — ikisini birleştirme. `app/social/layout.tsx` uygulamanın İLK iç
  içe layout'u; bu yüzden `team-page-wide`/`workspace-page-wide` (`.page-shell:has(> ...)`, direkt
  çocuk seçici) artık `/social` altındaki hiçbir sayfada çalışmaz — araya layout'un kendi
  wrapper'ı giriyor. Sidebar nav'da "Sosyal" `lib/nav.ts`'teki `NavItem.children` ile akordeona
  dönüşür: `visibleNavGroups()`/`isNavActive()` de buradan (2026-08-11'den önce iki ayrı renderer
  `NavLinks`/`SidebarNavLinks` bu filtreyi kopyalıyordu, artık tek `SidebarNav` var — bkz. aşağıdaki
  tasarım revizyonu notu).

## Kritik tuzaklar (bunlara dikkat)

- **null-prototype satırlar:** `node:sqlite` sorgu sonuçları null-proto obje döner; React bunları
  Server→Client component'e **geçiremez** (500 hatası). Repository'lerde her okuma
  `plainList<T>()` / `plainOne<T>()` (client.ts) ile düz objeye çevrilmeli. Yeni repo fonksiyonu
  yazarken bunu unutma.
- **force-dynamic:** DB okuyan her sayfada `export const dynamic = "force-dynamic"` var — yoksa
  build sırasında statik snapshot alınıp bayat veri servis edilir. (Layout `cookies()` okuduğu
  için zaten dinamik ama açıkça belirtiliyor.) `cacheComponents` KAPALI, bilinçli.
- **async params:** Next 16'da `params` bir Promise → `const { x } = await params`.
- **LAN:** `npm run start` → `next start -H 0.0.0.0 -p 3000`. 2026-08-14'te v02 → v03
  geçişi yapıldı: ekibin kullandığı canlı sürüm artık bu, v02 sunucusu durduruldu ve
  v02'nin son verisi (28 tablo, satır satır doğrulanarak) buraya aktarıldı. **Port 3001
  tamamen bırakıldı** — `npm run dev` de artık 3000'de çalışıyor (v02'deki düzenin aynısı).
  Dev ve production aynı portu ve aynı `data/inturlam.db` dosyasını kullandığı için ikisi
  AYNI ANDA çalıştırılamaz: birini başlatmadan önce diğerini durdur. Firewall notu README'de.
- **`ALTER TABLE ... RENAME` FK'leri kırar:** SQLite bir tabloyu yeniden adlandırınca, ona referans
  veren diğer tabloların FK metnini otomatik yeni isme günceller. Bir tabloyu CHECK kısıtlaması
  gibi bir nedenle yeniden kurman gerekirse ESKİ tabloyu asla rename etme — YENİ tabloyu geçici
  isimle kur, veriyi kopyala, eskiyi sil, yeniyi doğru isme çevir (bkz. `migrateBrandsTableIfNeeded`
  içindeki `brands_new_migration` deseni). Tersi (önce eskiyi rename) diğer tabloların FK'lerini
  var olmayan bir tabloya işaret eder hale getirir — sessizce, ta ki o tabloya dokunulana kadar.
- **Node native TS import + tsc:** `db/seed.mts` artık `lib/db/client.ts`'i relative path + açık
  `.ts` uzantısıyla import ediyor (`../lib/db/client.ts`) — Node'un native TypeScript
  çalıştırıcısı bunu gerektiriyor. Ama `tsc` bu uzantıyı varsayılan olarak reddeder; bu yüzden
  `tsconfig.json`'da `allowImportingTsExtensions: true` var (yalnızca `noEmit: true` ile
  birlikte kullanılabilir, bizde zaten öyle).
- **Migration DDL + dev sunucusu:** `npm run db:seed` şema değiştiren bir migration tetikleyebilir
  (`migrateBrandsTableIfNeeded`, `migrateContentItemsTableIfNeeded`). Dev sunucusu (`npm run dev`)
  aynı `data/inturlam.db` dosyasını açık tutarken seed'i çalıştırmak kilit çakışmasına yol
  açabilir — önce dev sunucusunu durdur, seed'i çalıştır, sonra tekrar başlat.
- **Kategoriler artık sabit değil:** `lib/constants.ts`'teki `CLUSTERS`/`CLUSTER_LABEL` kaldırıldı.
  Kategoriler `clusters` tablosunda; sunucu tarafında `listClusters()` / `clusterLabelMap()` /
  `groupBrandsByCluster()` (`lib/repositories/clusters.ts`) ile okunur, client component'lere prop
  olarak taşınır. `brands.cluster` ile `clusters.id` arasında **bilinçli olarak FK yok** — kategori
  silinince marka kaydı düşmesin diye. Bunun bedeli: "boş mu" kontrolü action'da elle yapılıyor
  (`deleteClusterAction`) ve gruplama fonksiyonu sahipsiz markaları "Kategorisiz" başlığında
  toplamak zorunda. Yeni bir yerde kategori etiketi gösterirken `?? UNKNOWN_CLUSTER_LABEL` yaz.
- **`migrateBrandsTableIfNeeded` artık iki taraflı korunmalı:** `brands.cluster` üzerindeki CHECK
  kısıtlaması `migrateBrandsDropClusterCheckIfNeeded` ile tamamen kaldırıldığı için, eski
  migration'ın guard'ı sadece `'emlak'` içeriyor mu diye bakamaz — CHECK hiç yoksa da erken dönmesi
  gerekir (`CLUSTER_CHECK_RE`), yoksa yalnızca 5 sütun kopyaladığı için geri kalan marka verisini
  siler. Aynı desende yeni bir brands migration'ı yazarsan bu guard zincirini gözden geçir.
- **`schema.sql`'in ilk uygulaması eski DB'de patlayabilir:** Yeni bir sütuna referans veren yeni
  bir `CREATE INDEX IF NOT EXISTS` eklersen (ör. `idx_content_items_assignee`), bu satır migration
  henüz çalışmadan, `schema.sql`'in İLK geçişinde (henüz eski yapıdaki tabloya karşı) çalışır ve
  "no such column" hatası verir — `CREATE TABLE IF NOT EXISTS` tablo zaten varsa no-op olur ama
  `CREATE INDEX IF NOT EXISTS` sadece o İSİMDE bir indeks zaten varsa no-op olur, sütunun var olup
  olmadığına bakmaz. Çözüm zaten `client.ts`'te: ilk `db.exec(schemaSql)` bir `try/catch` içinde
  (best-effort), sonra migration fonksiyonları çalışır, sonra `schemaSql` İKİNCİ kez uygulanır
  (bu sefer tablo doğru şekilde kurulmuş olduğu için hatasız geçer). Yeni bir migration eklerken
  bu deseni boz­ma — özellikle yeni sütun/CHECK içeren yeni bir index/constraint eklediğinde.
- **Takvim (`/calendar`) ay değil, IZGARA aralığı çeker:** `listTasksDueInRange`'e verilen aralık
  görüntülenen ayın 1'i–sonu değil, `calendarGridDays()`'in ürettiği dolgu günleri dahil TAM ızgara
  (önceki/sonraki aydan taşan Pazartesi–Pazar) aralığıdır — yoksa ay başında/sonunda soluk gösterilen
  komşu ay günleri her zaman boş görünür, oysa o günlerde gerçek görev olabilir. "Bu ay boş mu"
  kontrolü (`hasTasksThisMonth`) ayrıca ayın kendisiyle sınırlanır, ızgara dolgusuyla değil — ikisini
  karıştırma. Aynı fonksiyon, haftalık panoyu besleyen `listTasksDueThisWeek`'in aksine
  `'Yayinlandi'` durumunu FİLTRELEMİYOR (bilinçli: geçmiş bir ay tamamlanmış işi de göstermeli) —
  "tutarlı olsun" diye o filtreyi buraya kopyalama.
- **`CalendarGrid`'de hücrenin tamamı değil yalnızca tarih numarası link'tir:** Her öncelik pill'i
  kendi görevine (`/tasks/[id]`) ayrıca linkli; hücrenin tamamını da (gün detayına gitmek için)
  tıklanabilir yapmak iç içe `<a>` üretir (geçersiz HTML). Gün detayına gitmenin tek yolu tarih
  numarası (`touch-target` ile büyütülmüş) ve taşma metni ("+N daha") — hücrenin geri kalanı `<div>`.
- **@mention eşleştirmede en uzun isim önce kazanır:** `lib/mentions.ts` aktif kişileri isim
  uzunluğuna göre AZALAN sırada dener ve her eşleşen `[start,end)` aralığını `claimed` listesine
  ekler; daha kısa bir isim (`Yunus`) aynı aralıkta tekrar eşleşmeye çalışırsa (`Yunus Emre`'nin
  içindeki "Yunus" öneki gibi) bu, `claimed` ile çakıştığı için sayılmaz. Sırayı isim uzunluğuna
  göre değil de kişi listesi sırasına göre denersen kısa isim uzun ismi böler, yanlış kişiye
  bildirim gider. Bildirim üretimi (`extractMentionedPeople`) ve yorum metnindeki vurgulama
  (`CommentItem`) AYNI `findMentionMatches`'ı çağırır — biri güncellenip diğeri unutulamaz.
- **SQLite'ta `GROUP BY`/`ORDER BY` takma adı DEĞİL kaynak sütunu seçer:**
  `SELECT CASE ... END AS department ... GROUP BY department` yazarsan, `people` tablosunda
  zaten `department` adında bir sütun olduğu için gruplama CASE'in sonucuna değil ham
  sütuna göre yapılır — `listDepartmentReport`'ta NULL ile tanınmayan değer ayrı satır
  kalıp "Diğer" ikiye bölünmüştü (test yakaladı). Çıktı takma adı bir kaynak sütunla
  aynı adı taşıyorsa GROUP BY/ORDER BY'da **ifadenin kendisini** tekrarla.
- **Rapor sayaçlarında `LEFT JOIN` + "tüm zamanlar" tuzağı:** dönem koşulu aralık
  verilmediğinde sabit `1 = 1` üretiyor; `LEFT JOIN tasks`'ın görevi olmayan kişi/marka
  için ürettiği boş satır bu koşulu geçtiğinden "1 açılan iş" gibi sayılıyordu. Açılan
  işi sayan her `SUM(CASE WHEN <dönem> ...)` ifadesine `t.id IS NOT NULL AND` ekle
  (`listPersonReport`, `listBrandReport`, `listDepartmentReport`'ta var).
- **SQL'i template literal içinde yazarken yorumlara backtick koyma:** `-- \`t.id\`` gibi
  bir SQL yorumu template literal'i erkenden kapatır, hata satır numarasıyla birlikte
  anlamsız `TS1005` olarak döner. SQL yorumlarında çift tırnak kullan.
- **SVG `<title>` içine TEK bir metin çocuğu koy:** `<title>{a}: {b} görev</title>` biçimi
  birden çok text node üretiyor; React bunları SSR çıktısında ayırıcı yorumlarla yazıp
  hydration'da eşleştiremiyor ve tüm ağaç istemcide baştan çiziliyor ("Hydration failed",
  `ReportVisuals.tsx`'teki `TrendChart`'ta bir süre sessizce yaşadı). Doğrusu tek bir
  template literal: `<title>{`${a}: ${b} görev`}</title>`. Grafik tooltip'i yazarken dikkat.
- **Departman geri doldurması bir kereliktir:** `migratePeopleDepartmentIfNeeded`
  (`lib/db/client.ts`) sütunu eklerken eski ilk-isim eşlemesinden (DONMUŞ
  `LEGACY_DEPARTMENT_FIRST_NAMES` listesi) departmanları yazar, ama guard "sütun var mı"
  diye baktığı için **ikinci açılışta hiç çalışmaz** — kullanıcı birinin departmanını
  arayüzden boşaltırsa geri gelmez, olması gereken de bu. Aynı sebeple `db/seed.mts`
  departmanı `COALESCE(people.department, excluded.department)` ile yazıyor: seed, elle
  yapılan departman değişikliğini ezmez. Bu iki yerden birini değiştirirken diğerini de gör.
- **`"use client"` dosyasından sabit import etme (sunucuya):** Bir client component
  dosyasından export edilen düz değer (sabit string, obje) sunucu tarafında GERÇEK değer
  değil, bir istemci-referansı proxy'sidir. `BRAND_VIEW_COOKIE` bir süre
  `BrandViewToggle.tsx` içinde yaşadı ve `app/brands/page.tsx`'te
  `cookies().get(BRAND_VIEW_COOKIE)` sessizce `undefined` döndü (hata yok, tercih hiç
  hatırlanmadı — `store.toString()` çerezi gösterdiği hâlde). İki tarafın paylaştığı her
  sabit `lib/` altında, "use client" OLMAYAN bir modülde durmalı (şimdi `lib/constants.ts`).
- **Portal eden modal SSR'da `document` arar:** `QuickAddModal` `createPortal(..., document.body)`
  kullanıyor; takvimden gelen "+" kısayolu için `initialOpen` ile AÇIK render edilince sunucu
  render'ı `document is not defined` ile patlayıp React sayfayı sessizce istemci render'ına
  düşürüyordu (konsolda değil, yalnızca dev overlay'inde "Recoverable Error"). Çözüm bileşenin
  içindeki `useIsClient()` — sunucuda `false`, istemcide `true` döndüren bir
  `useSyncExternalStore`; portal yalnızca tarayıcıda çizilir, `useEffect` gerekmez.
- **Sunucu props'unu optimistic client state'e `useEffect` OLMADAN yansıt:** `NotificationBell`
  gelen `notifications`/`unreadCount` prop'larını yerel state'e kopyalayıp bir `useEffect` içinde
  senkronlamıyor (bu `react-hooks/set-state-in-effect`'e takılırdı, bkz. yukarıdaki Sidebar notu —
  aynı kural burada da geçerli). Bunun yerine yalnızca "bu oturumda okundu işaretlenen id'ler"
  kümesini tutuyor; ekrana çizilen liste ve rozet sayısı her render'da `props` ile bu küçük
  override kümesinden TÜRETİLİYOR. Sunucu verisi + iyimser tıklama gerektiren yeni bir bileşende
  bu deseni tercih et — prop'u state'e kopyalamak neredeyse hep bir senkronizasyon efekti gerektirir.

## Marka sayfası: kaldırılan araştırma verileri

Marka detayında eskiden "İlgili markalar" kartları, tam denetim raporunun markdown'ı, medyan
Reel izlenmesi ve kapak testi rozeti vardı — günlük iş takibinde kullanılmadıkları için arayüzden
kaldırıldı (2026-07-25). Kalan: takipçi + gönderi sayısı ve `key_finding` üzerinden gösterilen
kısa bilgilendirme metni.

**Veri silinmedi, sadece gösterilmiyor:** `brand_relations` / `brand_audits` tabloları ve
`brands.median_reel_views` / `cover_test_verdict` / `cover_test_note` / `first_action` sütunları
duruyor, `db/seed.mts` hâlâ vault'tan dolduruyor. `listBrandRelations()` ve `getBrandAudit()`
okuma yolu da yerinde ama artık ÇAĞRILMIYOR — geri istenirse birkaç satırlık iş. Buna bağlı
Markdown raporu geri istenirse ilgili gösterim bağımlılıklarının yeniden eklenmesi gerekir;
`react-markdown` ve `@tailwindcss/typography` artık pakette yok. `updateBrand()` bu sütunları
artık YAZMIYOR.

`brands.stats_updated_at`: takipçi/gönderi haftalık elle giriliyor; damga yalnızca sayılardan
biri gerçekten değiştiğinde bugüne çekilir (yalnızca adı düzeltip kaydetmek tazelemez, yoksa
"tazelenmeli" uyarısı yalan söyler). 7 günden eskiyse marka sayfasında uyarı çıkar.

## Tasarım kuralları (yeni ekran/bileşen yazarken)

- **Aksan rengi `brand-*`**, asla `indigo-*` değil. Skala `globals.css`'teki `@theme inline`'da;
  marka rengini değiştirmek 11 satır.
- **Yüzey/kenarlık/soluk-metin token'ları (2026-08-11 tasarım revizyonu).** `globals.css`'teki
  `:root`/`.dark` artık `--surface`/`--surface-muted`/`--surface-hover`/`--border-subtle`/
  `--border-default`/`--text-muted` tanımlıyor, `@theme inline` bunları `bg-surface`,
  `bg-surface-muted`, `bg-surface-hover`, `border-border-subtle`, `border-border-default`,
  `text-muted` utility'lerine bağlıyor. Bunlar temaya göre KENDİ değerini değiştirir — yani
  `bg-surface`/`border-border-default`/`text-muted` yazarken AYRICA bir `dark:` class'ı gerekmez
  (eski `border-black/10 bg-white ... dark:border-white/10 dark:bg-zinc-900` dörtlüsünün tek
  karşılığı). Yeni bileşen/sayfa yazarken önce `components/ui/*`e bak (aşağı), oradaki
  primitive'ler bu token'ları zaten kullanıyor.
- **`components/ui/` altında paylaşılan primitive'ler var: `Button`, `Card`, `Badge`, `Input`,
  `Select`, `Textarea`, `PageHeader`.** Öncesinde her form kendi input/buton class string'ini
  (17 neredeyse-aynı varyant) tekrar yazıyordu, her sayfa kendi `<h1>` bloğunu icat ediyordu.
  Yeni bir form/sayfa/kart yazarken BUNLARI kullan, yeni bir inline class string YAZMA. `Button`
  hem gerçek `<button>` hem de `buttonClass({variant,size})` (Link gibi başka öğeleri buton gibi
  göstermek için) export ediyor. Async form gönderiminde hâlâ `SubmitButton` (useFormStatus ile
  çift gönderimi engeller) — o da artık aynı `buttonClass`'ı kullanıyor, ayrıca stil yazma.
- **Metin kontrastı iki temada da ≥ 4.5:1 olmalı.** Yeni kodda tercih edilen yol `text-muted`
  (yukarıdaki token — teması otomatik değişir). Eski `text-zinc-500 dark:text-zinc-400` ikilisi
  de hâlâ geçerli/doğru, ikisi aynı amaca hizmet ediyor. Kırmızı `text-rose-600 dark:text-rose-400`,
  aksan `text-brand-600 dark:text-brand-400`. Tek başına `text-zinc-500` koyu temada 3.67, tek
  başına `text-zinc-400` açık temada 2.8 — ikisi de kalır. `text-zinc-300` hiç kullanma. Rozetin
  kendi zemini varsa (`bg-black/5`) bir ton koyulaştır (`text-zinc-600`).
- **Odak halkası merkezi.** `globals.css`'te `:focus-visible` kuralı `@layer` dışında yazıldığı
  için Tailwind'in `focus:outline-none` utility'sini ezer — bileşene ayrıca `focus:ring-*`
  eklemeye gerek yok, `outline-none` yazmak da zararsız.
- **Grid çocuklarına `min-w-0`.** Grid hücrelerinin varsayılan `min-width: auto` değeri,
  `truncate`lı (nowrap) metnin ya da bir `<select>`'in en uzun seçeneğinin TAM genişliğini alt
  sınır kabul eder; hücre taşar ve telefonda sayfa yatay kayar. Kart/panel bir grid çocuğuysa
  `min-w-0` ekle (bkz. `app/page.tsx` TaskPanel, `components/TaskGridCard.tsx`).
- **Sidebar artık header'ın YANINDA, altında değil** (`app/layout.tsx`: `<div className="flex
  min-h-screen">` → sidebar sütunu + [Header, main] sütunu). Eskiden header tüm viewport
  genişliğinde tek başına duruyor, sidebar ve sayfa içeriği ayrı ayrı ortalanıyordu (1920px'te
  logo ile sayfa başlığı ~215px kayık düşüyordu). Yeni sayfa/bileşen eklerken header'ın sidebar'ın
  ÜSTÜNDEN geçtiğini VARSAYMA — artık geçmiyor.
- **Sidebar daraltması CSS'ten, React'ten değil.** Tercih `<html data-sidebar>` özniteliğinde ve
  layout'taki no-FOUC script'i onu ilk boyamadan önce yazıyor; genişliği `globals.css`'teki
  `.sidebar-panel` kuralı (16rem/256px) veriyor. React state'i olsaydı sayfa bir kare açık
  sidebar'la çizilirdi. `SidebarContext` bu yüzden `useSyncExternalStore` ile özniteliği okuyor
  (`useEffect` + `setState` fazladan render turu demek ve `react-hooks/set-state-in-effect`
  kuralına takılıyor).
- **Bölüm navigasyonu artık TEK bileşende: `components/SidebarNav.tsx`.** Hem masaüstü (her zaman
  görünen sol sütun) hem mobil off-canvas panel AYNI bileşeni render eder — eskiden `NavLinks`
  (üst bar dropdown) + `SidebarNavLinks` (mobil akordeon) diye iki ayrı bileşen aynı listeyi dört
  farklı görsel dilde tekrarlıyordu, ikisi de kaldırıldı. Liste `lib/nav.ts`'teki `NAV_GROUPS`'ta
  üç grupla (İşler/Marka/Yönetim, kullanıcı tercihiyle gruplanmış): yeni sayfa eklerken ilgili
  gruba yaz, tek yer güncellenir. `visibleNavGroups(canViewReports)` yönetici filtresini uyguluyor.
- **Küçük ikon butonlarına `touch-target`.** Görünümü değiştirmeden tıklama alanını mobilde
  44×44'e çıkarır (`globals.css`); `min-h-11` vermek satır yüksekliğini şişirirdi.
- **Hata mesajlarına `role="alert"`**, ikon-only butonlara `aria-label`, form gönderim
  butonları için `SubmitButton` (useFormStatus ile çift gönderimi engeller).
- Yarıçap hiyerarşisi (2026-08-11 revizyonu — "yumuşak kart" yönü daha büyük dış yarıçap seçti):
  dış panel/kart `rounded-2xl` (`components/ui/Card.tsx`), form/buton `rounded-xl`/`rounded-lg`
  (`components/ui/Button.tsx`/`Input.tsx`, boyuta göre), rozet/avatar `rounded-full`. Eski kodda
  hâlâ `rounded-lg`/`rounded-md` iç kart olarak geçebilir, bu bir hata değil — kademeli göç.

## Genişletirken

Yeni alan/özellik: `schema.sql` (CREATE TABLE IF NOT EXISTS) → `types.ts` → repo → action → sayfa.
Şema mevcut DB'ye `getDb()` her açılışta `IF NOT EXISTS` ile uygulanır; tablo ekleme güvenli.
Var olan bir tabloya sütun eklemek veya CHECK kısıtlamasını genişletmek için `client.ts`'teki
migration deseni (yukarı bak) örnek alınarak yeni bir migration fonksiyonu eklenmeli — hâlâ
genel bir migration sistemi yok, her değişiklik kendi idempotent fonksiyonunu yazıyor.
