import type { TaskStatus } from "@/lib/types";

export function taskArchiveMenuLabel(target: {
  archived: boolean;
  status: TaskStatus;
}): "Arşivle" | "Görevi iptal et" | "Yeniden aç" {
  if (target.archived) return "Yeniden aç";
  return target.status === "Yayinlandi" ? "Arşivle" : "Görevi iptal et";
}
