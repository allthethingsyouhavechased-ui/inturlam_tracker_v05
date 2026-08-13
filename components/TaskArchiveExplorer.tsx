"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ArchiveTaskButton from "@/components/ArchiveTaskButton";
import BrandLogo from "@/components/BrandLogo";
import EmptyState from "@/components/EmptyState";
import PersonAvatar from "@/components/PersonAvatar";
import Icon from "@/components/ui/Icon";
import { controlClass } from "@/components/ui/Input";
import {
  TASK_DIFFICULTIES,
  TASK_DIFFICULTY_BADGE,
  TASK_DIFFICULTY_LABEL,
  TASK_STATUS_LABEL,
} from "@/lib/constants";
import { formatDateShort } from "@/lib/date";
import { formatRevisionDuration } from "@/lib/taskMetadata";
import type { Person, TaskDifficulty, TaskWithContext } from "@/lib/types";

const selectClass = controlClass("focus:ring-2 focus:ring-brand-500/15");

function archiveMonth(value: string | null): string {
  return value?.slice(0, 7) ?? "unknown";
}

function monthLabel(month: string): string {
  if (month === "unknown") return "Tarihi bilinmeyen";
  const [year, rawMonth] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, rawMonth - 1, 1)));
}

export default function TaskArchiveExplorer({
  tasks,
  brands,
  people,
}: {
  tasks: TaskWithContext[];
  brands: { id: string; name: string; logo_path?: string | null }[];
  people: Person[];
}) {
  const [query, setQuery] = useState("");
  const [brandId, setBrandId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [difficulty, setDifficulty] = useState<TaskDifficulty | "" | "unset">("");
  const [revision, setRevision] = useState<"" | "none" | "has">("");
  const [month, setMonth] = useState("");

  const months = useMemo(
    () => [...new Set(tasks.map((task) => archiveMonth(task.archived_at)))].sort().reverse(),
    [tasks],
  );
  const logoByBrand = useMemo(
    () => new Map(brands.map((brand) => [brand.id, brand.logo_path ?? null])),
    [brands],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    return tasks.filter((task) => {
      if (brandId && task.brand_id !== brandId) return false;
      if (assigneeId && task.assignee_id !== assigneeId) return false;
      if (difficulty === "unset" && task.difficulty !== null) return false;
      if (difficulty && difficulty !== "unset" && task.difficulty !== difficulty) return false;
      if (revision === "none" && task.revision_count !== 0) return false;
      if (revision === "has" && task.revision_count === 0) return false;
      if (month && archiveMonth(task.archived_at) !== month) return false;
      if (
        needle &&
        ![task.title, task.brand_name, task.content_title, task.assignee_name ?? ""]
          .some((value) => value.toLocaleLowerCase("tr-TR").includes(needle))
      ) return false;
      return true;
    });
  }, [tasks, brandId, assigneeId, difficulty, revision, month, query]);

  const grouped = useMemo(() => {
    const groups = new Map<string, TaskWithContext[]>();
    for (const task of filtered) {
      const key = archiveMonth(task.archived_at);
      groups.set(key, [...(groups.get(key) ?? []), task]);
    }
    return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);
  const hasFilter = Boolean(query || brandId || assigneeId || difficulty || revision || month);

  function clearFilters() {
    setQuery("");
    setBrandId("");
    setAssigneeId("");
    setDifficulty("");
    setRevision("");
    setMonth("");
  }

  return (
    <div className="space-y-5">
      <section aria-label="Arşiv filtreleri" className="rounded-xl border border-border-default bg-surface p-3">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_repeat(5,minmax(9rem,0.55fr))]">
          <label className="relative grid gap-1 text-xs font-medium text-muted">
            Ara
            <span className="relative">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Görev, marka, çalışma veya kişi…" className={`${selectClass} w-full pl-10`} />
            </span>
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted">Marka<select value={brandId} onChange={(event) => setBrandId(event.target.value)} className={selectClass}><option value="">Tüm markalar</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-medium text-muted">Atanan<select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className={selectClass}><option value="">Herkes</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-medium text-muted">Zorluk<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as TaskDifficulty | "" | "unset")} className={selectClass}><option value="">Tümü</option>{TASK_DIFFICULTIES.map((value) => <option key={value} value={value}>{TASK_DIFFICULTY_LABEL[value]}</option>)}<option value="unset">Belirlenmemiş</option></select></label>
          <label className="grid gap-1 text-xs font-medium text-muted">Revize<select value={revision} onChange={(event) => setRevision(event.target.value as "" | "none" | "has")} className={selectClass}><option value="">Tümü</option><option value="none">Revizesiz</option><option value="has">Revize geçmişi olan</option></select></label>
          <label className="grid gap-1 text-xs font-medium text-muted">Arşiv ayı<select value={month} onChange={(event) => setMonth(event.target.value)} className={selectClass}><option value="">Tüm aylar</option>{months.map((value) => <option key={value} value={value}>{monthLabel(value)}</option>)}</select></label>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3 text-xs text-muted">
          <span><strong className="text-foreground">{filtered.length}</strong> / {tasks.length} arşiv kaydı</span>
          {hasFilter && <button type="button" onClick={clearFilters} className="ui-press min-h-8 rounded-lg px-2.5 font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30">Filtreleri temizle</button>}
        </div>
      </section>

      {grouped.length === 0 ? (
        <EmptyState title={hasFilter ? "Bu filtrelerle eşleşen arşiv kaydı yok" : "Arşiv henüz boş"} description={hasFilter ? "Arama veya filtrelerden birini değiştirebilirsin." : "Yayınlanan görevler arşivlendiğinde burada aylar halinde listelenecek."} />
      ) : grouped.map(([groupMonth, rows]) => (
        <section key={groupMonth} className="overflow-hidden rounded-xl border border-border-default bg-surface">
          <div className="flex items-center justify-between border-b border-border-subtle bg-surface-subtle px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold capitalize text-foreground">{monthLabel(groupMonth)}</h2>
            <span className="text-xs tabular-nums text-muted">{rows.length} görev</span>
          </div>
          <div className="divide-y divide-border-subtle">
            {rows.map((task) => (
              <article key={task.id} className="grid gap-3 px-4 py-4 sm:px-5 xl:grid-cols-[minmax(20rem,1.25fr)_minmax(12rem,0.65fr)_minmax(10rem,0.5fr)_auto] xl:items-center">
                <div className="flex min-w-0 items-start gap-3">
                  <BrandLogo name={task.brand_name} logoPath={logoByBrand.get(task.brand_id) ?? null} />
                  <div className="min-w-0">
                    <Link href={`/tasks/${task.id}`} className="line-clamp-2 text-sm font-semibold text-foreground hover:text-brand-600 dark:hover:text-brand-300">{task.title}</Link>
                    <p className="mt-1 truncate text-xs text-muted">{task.brand_name} · {task.content_title}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-surface-subtle px-2 py-1 text-[10px] font-semibold text-secondary">{TASK_STATUS_LABEL[task.status]}</span>
                  {task.difficulty ? <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${TASK_DIFFICULTY_BADGE[task.difficulty]}`}>{TASK_DIFFICULTY_LABEL[task.difficulty]}</span> : <span className="rounded-md border border-dashed border-border-strong px-2 py-1 text-[10px] text-muted">Zorluk belirlenmedi</span>}
                  <span className="rounded-md bg-surface-subtle px-2 py-1 text-[10px] font-semibold text-secondary">{task.weight_points} puan</span>
                </div>
                <div className="space-y-1 text-xs text-muted">
                  <p>Teslim: <span className="font-medium text-secondary">{task.due_date ? formatDateShort(task.due_date) : "Tarih yok"}</span></p>
                  <p>Revize: <span className="font-medium text-secondary">{task.revision_count > 0 ? `R${task.revision_count} · ${formatRevisionDuration(task.total_revision_minutes)}` : "Yok"}</span></p>
                  {task.assignee_name && <span className="inline-flex items-center gap-1.5"><PersonAvatar name={task.assignee_name} avatarPath={task.assignee_avatar_path} size="xs" />{task.assignee_name}</span>}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Link href={`/tasks/${task.id}`} className="ui-press inline-flex min-h-10 items-center rounded-xl border border-border-default px-3 text-xs font-semibold text-secondary hover:bg-surface-hover">Ayrıntılar</Link>
                  <ArchiveTaskButton taskId={task.id} archived />
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
