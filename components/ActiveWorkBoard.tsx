"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import PersonAvatar from "@/components/PersonAvatar";
import Icon from "@/components/ui/Icon";
import { setActiveBrandAction } from "@/lib/actions/activeWork";
import {
  groupPeopleByDepartment,
  type DepartmentKey,
  type DepartmentRow,
} from "@/lib/departments";
import type {
  Brand,
  Person,
  PersonActiveWork,
  TaskWithContext,
} from "@/lib/types";

function formatUpdatedAt(value: string): string {
  const isoValue = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(isoValue));
}

const workstreamTone: Record<DepartmentKey, { dot: string; badge: string }> = {
  video: {
    dot: "bg-sky-500",
    badge: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  design: {
    dot: "bg-violet-500",
    badge: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  social: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  management: {
    dot: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  other: {
    dot: "bg-zinc-400",
    badge: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
  },
};

export default function ActiveWorkBoard({
  people,
  brands,
  selections,
  tasks,
  currentPersonId,
}: {
  people: Person[];
  brands: Brand[];
  selections: PersonActiveWork[];
  tasks: TaskWithContext[];
  currentPersonId: string | null;
}) {
  const router = useRouter();
  const currentSelection = selections.find(
    (selection) => selection.person_id === currentPersonId,
  );
  const [selectedBrandId, setSelectedBrandId] = useState(
    currentSelection?.brand_id ?? "",
  );
  const [previousServerBrandId, setPreviousServerBrandId] = useState(
    currentSelection?.brand_id ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const serverBrandId = currentSelection?.brand_id ?? "";
  if (!pending && previousServerBrandId !== serverBrandId) {
    setPreviousServerBrandId(serverBrandId);
    setSelectedBrandId(serverBrandId);
  }

  const workstreamRows = useMemo(
    () => groupPeopleByDepartment(people),
    [people],
  );
  const currentWorkstreamId = workstreamRows.find((row) =>
    row.people.some((person) => person.id === currentPersonId),
  )?.id;
  const [selectedWorkstreamId, setSelectedWorkstreamId] = useState<DepartmentKey | "all">(
    currentWorkstreamId ?? workstreamRows[0]?.id ?? "all",
  );
  const [query, setQuery] = useState("");
  const visibleWorkstreams = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
    if (normalizedQuery) {
      return workstreamRows
        .map((row) => ({
          ...row,
          people: row.people.filter((person) =>
            [person.name, person.title, person.department]
              .filter(Boolean)
              .some((value) => value!.toLocaleLowerCase("tr-TR").includes(normalizedQuery)),
          ),
        }))
        .filter((row) => row.people.length > 0);
    }
    return selectedWorkstreamId === "all"
      ? workstreamRows
      : workstreamRows.filter((row) => row.id === selectedWorkstreamId);
  }, [query, selectedWorkstreamId, workstreamRows]);

  function changeBrand(nextBrandId: string) {
    const previousBrandId = selectedBrandId;
    setSelectedBrandId(nextBrandId);
    setError(null);

    startTransition(async () => {
      try {
        await setActiveBrandAction(nextBrandId || null);
        router.refresh();
      } catch (actionError) {
        setSelectedBrandId(previousBrandId);
        setError(
          actionError instanceof Error
            ? actionError.message
            : "Marka seçimi kaydedilemedi.",
        );
      }
    });
  }

  return (
    <section className="space-y-3" aria-labelledby="active-work-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted">KAPASİTE</p>
          <h2 id="active-work-title" className="mt-1 text-base font-semibold text-foreground">
            Aktif çalışma dağılımı
          </h2>
          <p className="mt-1 text-xs text-muted">
            Ekip üyeleri çalışma alanlarına göre satırlarda; aktif marka ve açık işleri kişi kartında.
          </p>
        </div>
        <p className="text-[11px] text-muted">
          Değişiklikler ekipte en geç 15 saniye içinde görünür.
        </p>
      </div>

      {!currentPersonId && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border-default border-l-[3px] border-l-amber-500 bg-surface px-4 py-3 text-sm text-secondary">
          <span>Kendi çalışma markanı seçmek için önce kimliğini belirle.</span>
          <Link
            href="/whoami"
            className="ui-press shrink-0 rounded-[9px] bg-amber-100 px-3 py-2 font-semibold text-amber-900 hover:bg-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-950"
          >
            Kimliğimi seç
          </Link>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/25 dark:text-rose-300"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-border-default bg-surface p-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Departman filtresi" className="flex min-w-0 gap-1 overflow-x-auto pb-1 lg:pb-0">
          <button
            type="button"
            onClick={() => { setSelectedWorkstreamId("all"); setQuery(""); }}
            aria-pressed={selectedWorkstreamId === "all" && !query}
            className={`ui-press min-h-9 shrink-0 rounded-[9px] px-3 text-xs font-semibold ${
              selectedWorkstreamId === "all" && !query
                ? "bg-brand-600 text-white"
                : "text-secondary hover:bg-surface-hover"
            }`}
          >
            Tümü · {people.length}
          </button>
          {workstreamRows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => { setSelectedWorkstreamId(row.id); setQuery(""); }}
              aria-pressed={selectedWorkstreamId === row.id && !query}
              className={`ui-press min-h-9 shrink-0 rounded-[9px] px-3 text-xs font-semibold ${
                selectedWorkstreamId === row.id && !query
                  ? "bg-brand-600 text-white"
                  : "text-secondary hover:bg-surface-hover"
              }`}
            >
              {row.label} · {row.people.length}
            </button>
          ))}
        </nav>
        <label className="relative min-w-0 lg:w-64">
          <span className="sr-only">Ekipte kişi ara</span>
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="İsim, unvan veya departman…"
            className="min-h-10 w-full rounded-[9px] border border-border-default bg-surface-subtle pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
          />
        </label>
      </div>

      <div className="space-y-3">
        {visibleWorkstreams.map((workstream) => (
          <WorkstreamSection
            key={workstream.id}
            workstream={workstream}
            tone={workstreamTone[workstream.id]}
            currentPersonId={currentPersonId}
            selections={selections}
            brands={brands}
            tasks={tasks}
            selectedBrandId={selectedBrandId}
            pending={pending}
            changeBrand={changeBrand}
          />
        ))}
        {visibleWorkstreams.length === 0 && (
          <div className="rounded-xl border border-dashed border-border-default bg-surface-subtle px-4 py-10 text-center text-sm text-muted">
            Bu aramayla eşleşen ekip üyesi bulunamadı.
          </div>
        )}
      </div>
    </section>
  );
}

function WorkstreamSection({
  workstream,
  tone,
  currentPersonId,
  selections,
  brands,
  tasks,
  selectedBrandId,
  pending,
  changeBrand,
}: {
  workstream: DepartmentRow<Person>;
  tone: { dot: string; badge: string };
  currentPersonId: string | null;
  selections: PersonActiveWork[];
  brands: Brand[];
  tasks: TaskWithContext[];
  selectedBrandId: string;
  pending: boolean;
  changeBrand: (nextBrandId: string) => void;
}) {
  return (
    <section
      aria-labelledby={`workstream-${workstream.id}`}
      className="rounded-xl border border-border-default bg-surface p-3"
    >
      <div className="flex min-h-11 w-full items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`size-2.5 rounded-full ${tone.dot}`} />
          <h3
            id={`workstream-${workstream.id}`}
            className="text-sm font-semibold text-foreground"
          >
            {workstream.label}
          </h3>
        </div>
        <span className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tabular-nums ${tone.badge}`}
          >
            {workstream.people.length} kişi
          </span>
        </span>
      </div>

      <div className="ui-enter mt-3 grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(230px,1fr))]">
          {workstream.people.map((person) => {
            const isCurrent = person.id === currentPersonId;
            const storedSelection = selections.find(
              (selection) => selection.person_id === person.id,
            );
            const brandId = isCurrent
              ? selectedBrandId
              : (storedSelection?.brand_id ?? "");
            const selectedBrand = brands.find((brand) => brand.id === brandId);
            const personTasks = brandId
              ? tasks.filter(
                  (task) =>
                    task.assignee_id === person.id &&
                    task.brand_id === brandId &&
                    task.status !== "Yayinlandi",
                )
              : [];

            return (
              <article
                key={person.id}
                className={`min-w-0 rounded-xl border bg-surface-subtle p-2.5 ${
                  isCurrent
                    ? "border-brand-400 ring-2 ring-brand-500/15 dark:border-brand-700"
                    : "border-border-subtle"
                }`}
              >
                <header className="flex min-h-12 items-center gap-2.5 px-1">
                  <PersonAvatar
                    name={person.name}
                    avatarPath={person.avatar_path}
                    size="md"
                  />
                  <span className="min-w-0 flex-1">
                    <Link href={`/team/${person.id}`} className="block truncate text-sm font-semibold text-foreground hover:text-brand-600 dark:hover:text-brand-300">
                      {person.name}
                    </Link>
                    <span
                      className={`mt-0.5 flex items-center gap-1.5 text-[11px] ${
                        selectedBrand
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          selectedBrand ? "bg-emerald-500" : "bg-zinc-400"
                        }`}
                      />
                      {selectedBrand ? "Çalışıyor" : "Marka seçilmedi"}
                    </span>
                  </span>
                  {isCurrent && (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                      Sen
                    </span>
                  )}
                </header>

                <div className="mt-2">
                  {isCurrent ? (
                    <label className="grid gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      Şu anda çalıştığım marka
                      <select
                        value={brandId}
                        onChange={(event) => changeBrand(event.target.value)}
                        disabled={pending}
                        className="min-h-10 w-full rounded-[9px] border border-border-default bg-surface px-3 text-sm font-medium text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 disabled:opacity-60"
                      >
                        <option value="">Müsaitim / marka seçmedim</option>
                        {brands.map((brand) => (
                          <option key={brand.id} value={brand.id}>
                            {brand.name}
                          </option>
                        ))}
                      </select>
                      {pending && (
                        <span className="text-brand-600 dark:text-brand-400">
                          Kaydediliyor…
                        </span>
                      )}
                    </label>
                  ) : selectedBrand ? (
                    <div className="flex min-h-10 items-center gap-2 rounded-[9px] border border-border-subtle bg-surface px-3 text-xs font-semibold text-secondary">
                      <Icon name="brands" className="size-3.5 text-muted" />
                      <span className="truncate">{selectedBrand.name}</span>
                    </div>
                  ) : (
                    <div className="rounded-[9px] border border-dashed border-border-default px-3 py-3 text-center text-xs text-muted">
                      Henüz marka seçmedi
                    </div>
                  )}
                </div>

                {selectedBrand &&
                  storedSelection?.brand_id === brandId &&
                  storedSelection.updated_at && (
                    <p className="mt-2 px-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                      Son seçim {formatUpdatedAt(storedSelection.updated_at)}
                    </p>
                  )}

                <div className="mt-3 space-y-1">
                  {personTasks.slice(0, 2).map((task) => (
                    <Link
                      key={task.id}
                      href={`/tasks/${task.id}`}
                      className="flex min-h-9 items-center gap-2 rounded-[8px] border border-border-subtle bg-surface px-2.5 text-[11px] text-secondary hover:border-border-strong hover:text-foreground"
                    >
                      <span className="size-1.5 shrink-0 rounded-full bg-brand-500" />
                      <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
                    </Link>
                  ))}

                  {selectedBrand && personTasks.length === 0 && (
                    <div className="rounded-[9px] border border-dashed border-border-subtle px-3 py-2 text-center text-[11px] text-muted">
                      Bu marka için açık görev yok.
                    </div>
                  )}

                  {personTasks.length > 2 && (
                    <p className="rounded-lg bg-surface-muted px-3 py-1.5 text-center text-[11px] font-medium text-secondary">
                      +{personTasks.length - 2} görev daha
                    </p>
                  )}
                </div>
              </article>
            );
          })}
      </div>
    </section>
  );
}
