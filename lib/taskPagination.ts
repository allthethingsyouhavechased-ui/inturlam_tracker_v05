import type { ListSort, ListSortKey } from "@/lib/taskSort";
import { taskFilterSearch, type TaskFilterState } from "@/lib/taskFilterParams";

export const TASK_PAGE_SIZE = 50;
const columns: ListSortKey[] = ["gorev", "tur", "marka", "oncelik", "zorluk", "puan", "revize", "durum", "atanan", "teslim", "hedef", "yorum"];
export function parseTaskPage(value?: string): number {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? Math.min(number, 1000000) : 1;
}
export function parseTaskListSort(column?: string, dir?: string): ListSort | null {
  return columns.includes(column as ListSortKey) ? { key: column as ListSortKey, dir: dir === "desc" ? "desc" : "asc" } : null;
}
export function taskPageHref(filters: TaskFilterState, page = 1, sort: ListSort | null = null): string {
  const query = new URLSearchParams(taskFilterSearch(filters));
  if (page > 1) query.set("page", String(page));
  if (sort) { query.set("column", sort.key); query.set("dir", sort.dir); }
  return `/tasks${query.size ? `?${query}` : ""}`;
}
