import { TASK_DIFFICULTIES, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { DEPARTMENTS, NO_DEPARTMENT } from "@/lib/departments";
import { parseTaskFocus, type TaskFocus } from "@/lib/taskFocus";
import type { TaskDueFilter } from "@/lib/taskMetadata";
import type { TaskDifficulty, TaskPriority, TaskStatus } from "@/lib/types";

export const TASK_SORT_KEYS = ["varsayilan", "marka", "durum", "oncelik", "atanan"] as const;
export type TaskSortKey = (typeof TASK_SORT_KEYS)[number];

const DUE_FILTERS: readonly TaskDueFilter[] = ["overdue", "today", "week", "undated"];

/**
 * `/tasks` ekranındaki filtrelerin tamamı. Değerler daima string ("" = filtre yok)
 * çünkü hem URL'den okunuyor hem de `<select>` değeri olarak kullanılıyor.
 */
export interface TaskFilterState {
  brand: string;
  status: TaskStatus | "";
  priority: TaskPriority | "";
  difficulty: TaskDifficulty | "" | "unset";
  /** Ağırlık puanı alt/üst sınırı; "" = sınır yok. */
  pointsMin: string;
  pointsMax: string;
  due: TaskDueFilter;
  from: string;
  to: string;
  department: string;
  assignee: string;
  focus: TaskFocus | "";
  q: string;
  sort: TaskSortKey;
}

export const EMPTY_TASK_FILTERS: TaskFilterState = {
  brand: "",
  status: "",
  priority: "",
  difficulty: "",
  pointsMin: "",
  pointsMax: "",
  due: "",
  from: "",
  to: "",
  department: "",
  assignee: "",
  focus: "",
  q: "",
  sort: "varsayilan",
};

export type TaskFilterSearchParams = Partial<Record<keyof TaskFilterState, string>>;

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | "" {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : "";
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `tasks.weight_points` CHECK'i 1-100; sınır dışı/sayı olmayan değer filtre yok
    sayılır — adres çubuğuna elle yazılan çöp listeyi boşaltmasın. */
function weightBound(value: string | undefined): string {
  if (!value) return "";
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) return "";
  return String(parsed);
}

/**
 * URL'den gelen ham `searchParams`'ı doğrulanmış filtre durumuna çevirir.
 * Tanınmayan her değer sessizce "filtre yok"a düşer — kullanıcı adres çubuğunda
 * ne yazarsa yazsın liste geçerli bir durumda açılır.
 *
 * Marka ve kişi id'leri burada doğrulanamaz (veritabanı bilgisi gerekir); onları
 * çağıran sayfa kendi listesine karşı süzer.
 */
export function parseTaskFilterParams(sp: TaskFilterSearchParams): TaskFilterState {
  return {
    brand: sp.brand?.trim() ?? "",
    status: oneOf<TaskStatus>(sp.status, TASK_STATUSES),
    priority: oneOf<TaskPriority>(sp.priority, TASK_PRIORITIES),
    difficulty: sp.difficulty === "unset"
      ? "unset"
      : oneOf<TaskDifficulty>(sp.difficulty, TASK_DIFFICULTIES),
    pointsMin: weightBound(sp.pointsMin),
    pointsMax: weightBound(sp.pointsMax),
    due: oneOf<TaskDueFilter>(sp.due, DUE_FILTERS) as TaskDueFilter,
    from: sp.from && ISO_DATE.test(sp.from) ? sp.from : "",
    to: sp.to && ISO_DATE.test(sp.to) ? sp.to : "",
    department: sp.department === NO_DEPARTMENT
      ? NO_DEPARTMENT
      : oneOf(sp.department, DEPARTMENTS.map((d) => d.id)),
    assignee: sp.assignee?.trim() ?? "",
    focus: parseTaskFocus(sp.focus),
    q: sp.q ?? "",
    sort: oneOf<TaskSortKey>(sp.sort, TASK_SORT_KEYS) || "varsayilan",
  };
}

/**
 * Filtre durumundan adres çubuğuna yazılacak sorgu dizesini üretir.
 * Varsayılan (boş) değerler URL'e HİÇ yazılmaz: hiç filtre seçilmemişken adres
 * çubuğu temiz kalsın, paylaşılan bağlantı da yalnız gerçekten seçilen filtreyi
 * taşısın diye.
 */
export function taskFilterSearch(filters: TaskFilterState): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters) as [keyof TaskFilterState, string][]) {
    if (!value) continue;
    if (key === "sort" && value === EMPTY_TASK_FILTERS.sort) continue;
    params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
