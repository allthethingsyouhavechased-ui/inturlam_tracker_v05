// Kategoriler artık `clusters` tablosunda tutuluyor (kullanıcı arayüzden yeni
// kategori ekleyebiliyor), bu yüzden sabit union değil serbest id.
export type Cluster = string;

export interface ClusterRow {
  id: string;
  label: string;
  sort_order: number;
  created_at: string;
}

export type ContentType =
  | "Reel"
  | "Post"
  | "Story"
  | "Foto"
  | "Kampanya"
  | "Video"
  | "Carousel"
  | "KurumsalKimlik"
  | "Diger";
export type ContentStatus = "Planlandi" | "Uretimde" | "Tamamlandi" | "IptalEdildi";
export type TaskStatus =
  | "Beklemede"
  | "DevamEdiyor"
  | "Incelemede"
  | "Onaylandi"
  | "Yayinlandi";

export type TaskPriority = "Dusuk" | "Normal" | "Yuksek" | "Acil";
export type TaskDifficulty = "Kolay" | "Orta" | "Zor" | "Ozel";
export type TaskDeliveryStatus = "Beklemede" | "Onaylandi" | "RevizeIstendi";
export type TaskRevisionReason =
  | "BriefDegisikligi"
  | "MusteriDegisikligi"
  | "Tasarim"
  | "Metin"
  | "Teknik"
  | "Diger";
export type AccountKind = "team" | "guest";
export type CalendarEventType = "Toplanti" | "Cekim" | "Diger";
export type CalendarEventColor = "auto" | "purple" | "blue" | "cyan" | "green" | "amber" | "rose" | "slate";
export type IdeaScope = "office" | "brand";
export type IdeaCategory = "Icerik" | "Kampanya" | "Gorsel" | "Strateji" | "Ofis" | "Diger";
export type IdeaStatus = "Yeni" | "Gelistiriliyor" | "Hazir" | "Kullanildi";
export type IdeaSourcePlatform = "Instagram" | "TikTok" | "Pinterest" | "YouTube" | "Web";

export interface Idea {
  id: string;
  scope_type: IdeaScope;
  brand_id: string | null;
  brand_name_snapshot: string | null;
  category: IdeaCategory;
  status: IdeaStatus;
  title: string;
  body: string;
  source_url: string | null;
  source_platform: IdeaSourcePlatform | null;
  tags_text: string | null;
  created_by_id: string | null;
  created_by_name: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IdeaWithContext extends Idea {
  brand_name: string | null;
}

export type ClientRequestStatus =
  | "Beklemede"
  | "Incelemede"
  | "Onaylandi"
  | "Reddedildi";

export interface ClientRequest {
  id: string;
  brand_id: string;
  title: string;
  description: string;
  requested_by_name: string | null;
  source: string | null;
  reference_url: string | null;
  department: string;
  content_type: ContentType;
  status: ClientRequestStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  due_date: string | null;
  created_by_id: string;
  reviewed_by_id: string | null;
  converted_task_id: string | null;
  reviewed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientRequestComment {
  id: string;
  request_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface ClientRequestAttachment {
  id: string;
  request_id: string;
  file_path: string;
  original_name: string | null;
  created_at: string;
}

// Sosyal medya üretim planındaki (hedef/varlık/takvim) sabit üç kategori.
// `ContentType` (proje türü, 9 üye) ile BİLEREK karıştırılmıyor — ekip
// "Reels" diyor, ContentType'taki "Reel" ayrı bir kavram (bir proje kaydı).
// Çalışma zamanı sabitleri (CONTENT_KINDS, etiketler) lib/socialPlan.ts'te.
export type ContentKind = "Post" | "Story" | "Reels";

export interface Brand {
  id: string;
  name: string;
  cluster: Cluster;
  sort_order: number;
  archived: number;
  logo_path: string | null;
  instagram_handle: string | null;
  follower_count: number | null;
  post_count: number | null;
  // Marka sayfasında gösterilen kısa bilgilendirme metni.
  key_finding: string | null;
  tier: string | null;
  // Takipçi/gönderi sayılarının son güncellendiği gün (YYYY-MM-DD).
  stats_updated_at: string | null;
  monthly_shoot_allowance: number | null;
  annual_shoot_allowance: number | null;
  // NOT: `brands` tablosunda ayrıca `median_reel_views`, `cover_test_verdict`,
  // `cover_test_note` ve `first_action` sütunları da var. Eski marka denetimi
  // verisi; arayüzden kaldırıldılar ve artık okunmuyorlar, bu yüzden bilerek
  // tipe dahil edilmediler. `SELECT *` bu alanları yine de getirir — tipe
  // eklemek isteyen önce neden gösterileceğine karar versin.
}

export interface Person {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  avatar_path: string | null;
  // Ekip disiplini (lib/departments.ts). Atanmamışsa null → arayüzde "Diğer".
  department: string | null;
  is_manager: number;
  active: number;
}

export interface Account {
  id: string;
  kind: AccountKind;
  person_id: string | null;
  brand_id: string | null;
  username: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface TeamActor {
  kind: "team";
  account_id: string;
  person: Person;
}

export interface GuestActor {
  kind: "guest";
  account_id: string;
  brand: Pick<Brand, "id" | "name" | "logo_path">;
  username: string;
}

export type Actor = TeamActor | GuestActor;

export interface PersonBrandAssignment {
  person_id: string;
  brand_id: string;
  brand_name: string;
  brand_logo_path: string | null;
  created_at: string;
}

export interface BrandPersonAssignment {
  person_id: string;
  person_name: string;
  person_avatar_path: string | null;
  person_title: string | null;
  brand_id: string;
  created_at: string;
}

export interface PersonActiveWork {
  person_id: string;
  brand_id: string;
  brand_name: string;
  updated_at: string;
}

export interface ContentItem {
  id: string;
  brand_id: string;
  title: string;
  type: ContentType;
  target_date: string | null;
  status: ContentStatus;
  assignee_id: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  content_item_id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  difficulty: TaskDifficulty | null;
  assignee_id: string | null;
  due_date: string | null;
  notes: string | null;
  weight_points: number;
  origin: "team" | "guest";
  requested_date: string | null;
  guest_brief: string | null;
  created_by_account_id: string | null;
  // Kaç günde bir tekrarlayacağı. null/0 = tekrar yok.
  repeat_days: number | null;
  completed_at: string | null;
  completed_by: string | null;
  // Arşive düşme damgası (SQLite UTC). null = pano/listelerde görünür.
  // "Yayınlandı" görevler ARCHIVE_AFTER_DAYS gün sonra damgalanır — bkz.
  // lib/taskArchive.ts. Kayıt silinmez, arşivden çıkarmak tek tıktır.
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SharedTaskComment {
  id: string;
  task_id: string;
  account_id: string;
  author_name: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface SharedTaskAttachment {
  id: string;
  task_id: string;
  account_id: string;
  file_path: string;
  original_name: string | null;
  created_at: string;
}

export interface GuestSharedTaskComment {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface GuestSharedTaskAttachment {
  id: string;
  file_path: string;
  original_name: string | null;
  created_at: string;
  can_delete: boolean;
}

export interface GuestTaskDTO {
  id: string;
  title: string;
  status: TaskStatus;
  requested_date: string;
  brief: string;
  content_title: string;
  content_type: ContentType;
  brand_id: string;
  brand_name: string;
  editable: boolean;
  comments: GuestSharedTaskComment[];
  attachments: GuestSharedTaskAttachment[];
  deliveries: GuestTaskDelivery[];
  created_at: string;
  updated_at: string;
}

export interface TaskDeliveryAttachment {
  id: string;
  delivery_id: string;
  file_path: string;
  original_name: string | null;
  created_at: string;
}

export interface TaskDelivery {
  id: string;
  task_id: string;
  version_number: number;
  note: string | null;
  external_url: string | null;
  guest_visible: number;
  status: TaskDeliveryStatus;
  submitted_by_account_id: string | null;
  submitted_by_name: string;
  submitted_at: string;
  decision_actor_kind: AccountKind | null;
  decided_by_account_id: string | null;
  decided_by_name: string | null;
  decision_note: string | null;
  revision_reason: TaskRevisionReason | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
  attachments: TaskDeliveryAttachment[];
}

export interface GuestTaskDelivery {
  id: string;
  version_number: number;
  note: string | null;
  external_url: string | null;
  status: TaskDeliveryStatus;
  submitted_by_name: string;
  submitted_at: string;
  decided_by_name: string | null;
  decision_note: string | null;
  revision_reason: TaskRevisionReason | null;
  decided_at: string | null;
  attachments: Array<Omit<TaskDeliveryAttachment, "delivery_id">>;
}

export interface MonthlyProgress {
  month: string;
  weighted_total: number;
  weighted_earned: number;
  percent: number | null;
  task_count: number;
}

export interface CalendarEvent {
  id: string;
  brand_id: string | null;
  brand_name?: string | null;
  type: CalendarEventType;
  color_key: CalendarEventColor;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  all_day: number;
  location: string | null;
  guest_visible: number;
  google_event_id: string | null;
  google_etag: string | null;
  google_updated_at: string | null;
  sync_status: "pending" | "synced" | "error";
  sync_error: string | null;
  deleted_at: string | null;
  created_by_account_id: string | null;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
}

export interface CalendarEventReport {
  event_id: string;
  participants: string | null;
  summary: string | null;
  decisions: string | null;
  next_steps: string | null;
  updated_by_id: string | null;
  updated_by_name: string | null;
  created_at: string | null;
  report_updated_at: string | null;
}

// Görev şablonu: bir içerik türü için standart iş akışı.
export interface TaskTemplate {
  id: string;
  name: string;
  content_type: ContentType | null;
  sort_order: number;
  created_at: string;
}

export interface TaskTemplateItem {
  id: string;
  template_id: string;
  title: string;
  priority: TaskPriority;
  difficulty: TaskDifficulty;
  assignee_id: string | null;
  // İçeriğin target_date'ine göre gün kayması (-3 = teslimden 3 gün önce).
  due_offset_days: number | null;
  sort_order: number;
}

export interface TaskTemplateWithItems extends TaskTemplate {
  items: TaskTemplateItem[];
}

export interface CommentAttachment {
  id: string;
  comment_id: string;
  file_path: string;
  original_name: string | null;
  created_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

// Görevin "Notlar" alanına eklenen görseller — CommentAttachment ile aynı
// şekilde, ama doğrudan bir task_id'ye bağlı.
export interface TaskAttachment {
  id: string;
  task_id: string;
  file_path: string;
  original_name: string | null;
  created_at: string;
}

export type ActivityEntityType =
  | "task"
  | "content"
  | "brand"
  | "cluster"
  | "template"
  | "request"
  | "idea"
  | "calendar_event";

export interface ActivityEntry {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  // Kaydın kendisi anlık görüntü (actor_name), ama avatar OKUMA ANINDA
  // people'dan JOIN'lenir — kişi hiç kalıcı silinmediği için güvenli, ve
  // kişi fotoğrafını sonradan değiştirirse eski kayıtlar da güncel gösterir.
  actor_avatar_path: string | null;
  action: string;
  entity_type: ActivityEntityType;
  entity_id: string | null;
  brand_id: string | null;
  summary: string;
  created_at: string;
}

// @mention bildirimi. recipient/actor/task/brand alanları activity_log ile
// aynı gerekçeyle anlık (snapshot) tutulur — FK yok, bkz. schema.sql.
export interface Notification {
  id: string;
  recipient_id: string;
  recipient_name: string | null;
  actor_id: string | null;
  actor_name: string | null;
  task_id: string | null;
  calendar_event_id: string | null;
  calendar_event_start_at?: string | null;
  brand_id: string | null;
  summary: string;
  read: number;
  created_at: string;
}

export interface TaskCardBadge {
  label: string;
  className: string;
}

export interface TaskWithContext extends Task {
  assignee_name: string | null;
  assignee_avatar_path: string | null;
  content_title: string;
  content_type: ContentType;
  brand_id: string;
  brand_name: string;
  // Yorum özeti: kartın altında ve liste görünümünün "Yorum" sütununda,
  // görevi açmadan "burada bir konuşma var mı" sorusunu cevaplar.
  comment_count: number;
  last_comment_body: string | null;
  last_comment_author: string | null;
  revision_count: number;
  active_revision_id: string | null;
  active_revision_started_at: string | null;
  active_revision_target_minutes: number | null;
  active_revision_elapsed_minutes: number | null;
  total_revision_minutes: number;
  // Panom'un birleşik board'unda bir görevin "neden burada" olduğunu gösteren
  // rozetler (Benim/Gecikmiş/Bu hafta gibi) — sunucuda hesaplanıp düz veri
  // olarak taşınır (Server→Client Component sınırında fonksiyon geçirilemez).
  badges?: TaskCardBadge[];
  // Yalnızca oturumdaki kişiye ait hedef, bu veriyi isteyen sayfalarda eklenir.
  // Alan opsiyoneldir; ortak görev sorguları başka kullanıcıların hedefini taşımaz.
  personal_target_date?: string | null;
}

export interface PersonalTaskTarget {
  task_id: string;
  person_id: string;
  target_date: string;
  updated_at: string;
}

export interface TaskWithPersonalTarget extends TaskWithContext {
  personal_target_date: string | null;
}

export interface BrandWithCount extends Brand {
  open_count: number;
}

// ————— Sosyal medya takibi —————

export interface SocialPost {
  id: string;
  brand_id: string;
  platform: string;
  external_id: string;
  permalink: string | null;
  media_type: string | null;
  caption: string | null;
  posted_at: string;
  fetched_at: string;
}

export type SocialSyncStatus = "running" | "ok" | "error";

export interface SocialSyncRun {
  id: string;
  provider: string;
  status: SocialSyncStatus;
  accounts: number;
  new_posts: number;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface BrandSocialState {
  brand_id: string;
  platform: string;
  handle: string | null;
  last_post_at: string | null;
  last_checked_at: string | null;
  last_status: "ok" | "error" | null;
  last_error: string | null;
  alerted_at: string | null;
}

// Ekranların okuduğu birleşik satır: marka + son durum + türetilmiş sessizlik
// bilgisi. `days_silent` yalnızca son paylaşım BİLİNİYORSA doludur; hiç veri
// çekilememiş bir hesapta null kalır ve arayüzde "veri yok" olarak gösterilir
// — "0 gündür sessiz" ile karıştırılmamalı.
export interface BrandSocialRow {
  brand_id: string;
  brand_name: string;
  logo_path: string | null;
  handle: string | null;
  last_post_at: string | null;
  last_post_permalink: string | null;
  last_checked_at: string | null;
  last_status: "ok" | "error" | null;
  last_error: string | null;
  days_silent: number | null;
  post_count_30d: number;
}

// ————— Sosyal medya üretim planı (hedef / varlık / paylaşım takvimi) —————
// "Takip" (yukarıdaki BrandSocialRow) bloğundan bağımsız — bu üçü elle girilir.

export interface BrandContentTarget {
  brand_id: string;
  kind: string;
  monthly_target: number;
  updated_at: string;
}

export interface BrandAssetCount {
  brand_id: string;
  kind: string;
  ready_count: number;
  updated_at: string;
}

export interface TaskRevisionRound {
  id: string;
  task_id: string;
  round_number: number;
  target_minutes: number;
  note: string | null;
  started_at: string;
  completed_at: string | null;
  created_by: string | null;
  completed_by: string | null;
  created_by_name: string | null;
  completed_by_name: string | null;
  elapsed_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface BrandMonthlyContentCompletion {
  brand_id: string;
  month: string; // 'YYYY-MM'
  completed_by: string | null;
  completed_at: string;
}

// Paylaşım takvimindeki tek bir gün. `combo` boş satır hiç üretilmez (silinir),
// bu yüzden burada nullable değil.
export interface BrandPlanEntry {
  brand_id: string;
  plan_date: string; // 'YYYY-MM-DD'
  combo: string;
  updated_at: string;
}

// Varlık sayfasının okuduğu birleşik satır: marka + üç kategorinin hedef/hazır
// sayıları. Hedefi/sayacı hiç girilmemiş markada değer 0'dır (satır yine
// üretilir, "veri yok" diye gizlenmez — arşivli markalar zaten listeye hiç
// girmiyor).
export interface BrandVarlikRow {
  brand_id: string;
  brand_name: string;
  logo_path: string | null;
  targets: Record<ContentKind, number>;
  ready: Record<ContentKind, number>;
  monthly_content_completed: boolean;
  monthly_content_completed_at: string | null;
}
