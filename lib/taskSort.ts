import { CONTENT_TYPE_LABEL, TASK_DIFFICULTIES, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import type { TaskPriority, TaskStatus, TaskWithContext } from "@/lib/types";

// Liste görünümündeki tıklanabilir sütun sıralaması. Hem /tasks hem /panom
// aynı davranışı kullansın diye burada — saf fonksiyonlar, DB'ye dokunmaz.

export type ListSortKey =
  | "gorev"
  | "tur"
  | "marka"
  | "oncelik"
  | "zorluk"
  | "puan"
  | "revize"
  | "durum"
  | "atanan"
  | "teslim"
  | "hedef"
  | "yorum";
export type SortDir = "asc" | "desc";
export interface ListSort {
  key: ListSortKey;
  dir: SortDir;
}

// Sütun başlığındaki metin + tıklandığında ne olacağını anlatan ipucu.
export const LIST_SORT_HINT: Record<ListSortKey, string> = {
  gorev: "Göreve göre sırala (A → Z)",
  tur: "İçerik türüne göre sırala (A → Z)",
  marka: "Markaya göre sırala — aynı markanın görevleri alt alta",
  oncelik: "Önceliğe göre sırala (Acil → Düşük)",
  zorluk: "Zorluğa göre sırala (Zor → Kolay; Özel ayrı kategori)",
  puan: "Ağırlık puanına göre sırala (yüksek → düşük)",
  revize: "Revize turu sayısına göre sırala",
  durum: "Duruma göre sırala (Beklemede → Yayınlandı)",
  atanan: "Atanana göre sırala — atanmamışlar en sonda",
  teslim: "Teslim tarihine göre sırala — tarihsizler en sonda",
  hedef: "Kişisel hedef tarihine göre sırala — hedefsizler en sonda",
  yorum: "Yorum sayısına göre sırala — yorumsuzlar en sonda",
};

const collator = new Intl.Collator("tr");

// TASK_PRIORITIES düşükten yükseğe tanımlı; listede "asc" = en acil önce
// olsun istiyoruz, bu yüzden ters indeks.
function priorityRank(p: TaskPriority): number {
  return TASK_PRIORITIES.length - 1 - TASK_PRIORITIES.indexOf(p);
}

function statusRank(s: TaskStatus): number {
  return TASK_STATUSES.indexOf(s);
}

// Değeri olmayan satırlar (atanmamış görev, tarihsiz görev) yön ne olursa olsun
// hep en sonda kalır — tabloların genel beklentisi bu.
function isEmpty(t: TaskWithContext, key: ListSortKey): boolean {
  if (key === "atanan") return !t.assignee_name;
  if (key === "teslim") return !t.due_date;
  if (key === "hedef") return !t.personal_target_date;
  if (key === "yorum") return t.comment_count === 0;
  if (key === "zorluk") return !t.difficulty;
  if (key === "revize") return t.revision_count === 0;
  return false;
}

function compare(a: TaskWithContext, b: TaskWithContext, key: ListSortKey): number {
  switch (key) {
    case "gorev":
      return collator.compare(a.title, b.title);
    case "tur":
      return collator.compare(CONTENT_TYPE_LABEL[a.content_type], CONTENT_TYPE_LABEL[b.content_type]);
    case "marka":
      // Aynı marka içinde önce projeye, sonra başlığa göre — marka bloğu kendi
      // içinde de rastgele değil, okunabilir sıralansın.
      return (
        collator.compare(a.brand_name, b.brand_name) ||
        collator.compare(a.content_title, b.content_title) ||
        collator.compare(a.title, b.title)
      );
    case "oncelik":
      return priorityRank(a.priority) - priorityRank(b.priority);
    case "zorluk": {
      const rank = (value: TaskWithContext["difficulty"]) => {
        if (value === "Ozel") return TASK_DIFFICULTIES.length;
        return value ? TASK_DIFFICULTIES.length - 1 - TASK_DIFFICULTIES.indexOf(value) : 99;
      };
      return rank(a.difficulty) - rank(b.difficulty);
    }
    // Puan da revize gibi "çok olan önce": listede aranan şey ağır iş, en
    // hafifi değil.
    case "puan":
      return b.weight_points - a.weight_points;
    case "revize":
      return b.revision_count - a.revision_count;
    case "durum":
      return statusRank(a.status) - statusRank(b.status);
    case "atanan":
      return collator.compare(a.assignee_name ?? "", b.assignee_name ?? "");
    case "teslim":
      return (a.due_date ?? "").localeCompare(b.due_date ?? "");
    case "hedef":
      return (a.personal_target_date ?? "").localeCompare(b.personal_target_date ?? "");
    case "yorum":
      // "asc" = en çok konuşulan önce. Sayıca sıralamada kullanıcının aradığı
      // şey "hangi görevde trafik var", en boş olan değil.
      return b.comment_count - a.comment_count;
  }
}

export function sortTasksForList(
  tasks: TaskWithContext[],
  sort: ListSort,
): TaskWithContext[] {
  const factor = sort.dir === "asc" ? 1 : -1;
  return [...tasks].sort((a, b) => {
    const aEmpty = isEmpty(a, sort.key);
    const bEmpty = isEmpty(b, sort.key);
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
    if (aEmpty && bEmpty) return collator.compare(a.title, b.title);
    const primary = compare(a, b, sort.key) * factor;
    // Eşitlikte marka + başlık: aynı öncelikteki görevler her render'da aynı
    // sırada dursun (kararlı ve tahmin edilebilir görünüm).
    return (
      primary ||
      collator.compare(a.brand_name, b.brand_name) ||
      collator.compare(a.title, b.title)
    );
  });
}

// Başlığa tıklama döngüsü: artan → azalan → varsayılan (sıralama yok).
export function nextSort(current: ListSort | null, key: ListSortKey): ListSort | null {
  if (!current || current.key !== key) return { key, dir: "asc" };
  if (current.dir === "asc") return { key, dir: "desc" };
  return null;
}
