"use client";

import { useMemo, useState } from "react";
import ActivityFeed from "@/components/ActivityFeed";
import Icon from "@/components/ui/Icon";
import { filterActivityEntries } from "@/lib/activitySearch";
import type { ActivityEntry } from "@/lib/types";

export default function ActivitySearch({ entries }: { entries: ActivityEntry[] }) {
  const [query, setQuery] = useState("");
  const [entityType, setEntityType] = useState<"all" | "task" | "content" | "brand" | "request" | "idea">("all");
  const filteredEntries = useMemo(
    () => filterActivityEntries(entries, query).filter((entry) => entityType === "all" || entry.entity_type === entityType),
    [entries, entityType, query],
  );

  function clearSearch() {
    setQuery("");
    setEntityType("all");
  }

  return (
    <div className="space-y-3">
      <div
        role="search"
        aria-label="Aktivitelerde ara"
        className="rounded-xl border border-border-default bg-surface p-3"
      >
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Aktivite ara</span>
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Kişi, görev, fikir veya işlem ara…"
            className="min-h-10 w-full rounded-[9px] border border-border-default bg-surface-subtle pl-9 pr-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
          />
        </label>
        <div className="flex min-w-0 gap-1 overflow-x-auto">
          {([
            ["all", "Tümü"],
            ["task", "Görev"],
            ["content", "İçerik"],
            ["brand", "Marka"],
            ["request", "Talep"],
            ["idea", "Fikir"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setEntityType(value)}
              aria-pressed={entityType === value}
              className={`ui-press min-h-9 shrink-0 rounded-[9px] px-3 text-xs font-semibold ${entityType === value ? "bg-brand-600 text-white" : "text-secondary hover:bg-surface-hover"}`}
            >
              {label}
            </button>
          ))}
          {(query || entityType !== "all") && (
          <button
            type="button"
            onClick={clearSearch}
            className="ui-press min-h-9 shrink-0 rounded-[9px] px-3 text-xs font-semibold text-muted hover:bg-surface-hover hover:text-foreground"
          >
            Temizle
          </button>
          )}
        </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3 text-[11px] text-muted">
          <span>En yeni hareketler önce gösterilir.</span>
          <span className="font-semibold tabular-nums text-secondary">{filteredEntries.length} kayıt</span>
        </div>
      </div>

      {(query || entityType !== "all") && (
        <p role="status" className="text-xs text-zinc-500 dark:text-zinc-400">
          {query ? `“${query}” araması` : "Seçili tür"} için {filteredEntries.length} sonuç
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-border-default bg-surface">
        <ActivityFeed
          entries={filteredEntries}
          emptyText={
            query
              ? "Bu aramayla eşleşen aktivite bulunamadı."
              : "Henüz kayıtlı hareket yok. Bir görev oluştur, durum değiştir ya da yorum yaz — burada görünecek."
          }
        />
      </div>
    </div>
  );
}
