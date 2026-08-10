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
  assignee_id: string | null;
  due_date: string | null;
  notes: string | null;
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
  | "template";

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
