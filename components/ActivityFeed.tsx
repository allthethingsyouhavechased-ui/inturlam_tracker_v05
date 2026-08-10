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
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">{emptyText}</p>;
  }

  return (
    <ul className="space-y-1">
      {entries.map((e) => {
        const href = showLink ? hrefFor(e) : null;
        return (
          <li
            key={e.id}
            className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
          >
            {e.actor_name ? (
              <PersonAvatar name={e.actor_name} avatarPath={e.actor_avatar_path} size="xs" />
            ) : (
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] text-zinc-500 dark:text-zinc-400 dark:bg-zinc-700">
                ?
              </span>
            )}
            <div className="min-w-0 flex-1 text-sm">
              <span className="text-zinc-700 dark:text-zinc-200">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {e.actor_name ?? "Biri"}
                </span>{" "}
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
              <span className="ml-2 whitespace-nowrap text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                {formatDateTime(e.created_at)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
