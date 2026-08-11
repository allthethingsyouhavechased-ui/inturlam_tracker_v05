import Link from "next/link";
import PersonAvatar from "@/components/PersonAvatar";
import { formatDateTime } from "@/lib/date";
import type { ActivityEntry } from "@/lib/types";

// Bir aktivite kaydının işaret ettiği varlığın linki. Silme olaylarında
// entity_id null bırakıldığı için (ölü link olmasın) buradan null döner.
function hrefFor(e: ActivityEntry): string | null {
  if (!e.entity_id) return null;
  if (e.entity_type === "task") return `/tasks/${e.entity_id}`;
  if (e.entity_type === "brand") return `/brands/${e.entity_id}`;
  if (e.entity_type === "request") return `/requests/${e.entity_id}`;
  if (e.entity_type === "content" && e.brand_id) {
    return `/brands/${e.brand_id}/content/${e.entity_id}`;
  }
  return null;
}

export default function ActivityFeed({
  entries,
  showLink = true,
  emptyText = "Henüz kayıtlı hareket yok.",
}: {
  entries: ActivityEntry[];
  showLink?: boolean;
  emptyText?: string;
}) {
  if (entries.length === 0) {
    return <p className="px-4 py-5 text-[13px] text-muted">{emptyText}</p>;
  }

  return (
    <ul className="divide-y divide-border-subtle">
      {entries.map((e) => {
        const href = showLink ? hrefFor(e) : null;
        const entityLabel = e.entity_type === "task" ? "Görev" : e.entity_type === "content" ? "İçerik" : e.entity_type === "brand" ? "Marka" : e.entity_type === "request" ? "Talep" : "Sistem";
        return (
          <li
            key={e.id}
            className="group grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-hover sm:grid-cols-[auto_minmax(0,1fr)_auto]"
          >
            {e.actor_name ? (
              <PersonAvatar name={e.actor_name} avatarPath={e.actor_avatar_path} size="xs" />
            ) : (
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] text-zinc-500 dark:text-zinc-400 dark:bg-zinc-700">
                ?
              </span>
            )}
            <div className="min-w-0 text-sm">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-muted">{entityLabel.toLocaleUpperCase("tr-TR")}</span>
                <span className="truncate text-[11px] font-semibold text-secondary">{e.actor_name ?? "Sistem"}</span>
              </div>
              <span className="text-[13px] leading-5 text-secondary">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {e.actor_name ?? "Biri"}{" "}
                </span>
                {href ? (
                  <Link
                    href={href}
                    className="decoration-zinc-300 underline-offset-2 hover:text-brand-600 dark:hover:text-brand-400 hover:underline dark:decoration-zinc-600 dark:hover:text-brand-400"
                  >
                    {e.summary}
                  </Link>
                ) : (
                  e.summary
                )}
              </span>
            </div>
            <time className="col-start-2 whitespace-nowrap text-[10px] tabular-nums text-muted sm:col-start-3 sm:row-start-1">
              {formatDateTime(e.created_at)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
