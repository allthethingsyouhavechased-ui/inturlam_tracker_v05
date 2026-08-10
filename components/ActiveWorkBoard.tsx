"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import PersonAvatar from "@/components/PersonAvatar";
import TaskGridCard from "@/components/TaskGridCard";
import { setActiveBrandAction } from "@/lib/actions/activeWork";
import { hashColor } from "@/lib/colorHash";
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
import { usePanelOpen } from "@/lib/usePanelOpen";

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
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgb(16_185_129_/_0.12)]" />
            <h2
              id="active-work-title"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
            >
              Disiplin bazlı ekip kanbanı
            </h2>
          </div>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Ekip üyeleri çalışma alanlarına göre satırlarda; aktif marka ve açık işleri kişi kartında.
          </p>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Değişiklikler ekipte en geç 15 saniye içinde görünür.
        </p>
      </div>

      {!currentPersonId && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-300">
          <span>Kendi çalışma markanı seçmek için önce kimliğini belirle.</span>
          <Link
            href="/whoami"
            className="ui-press shrink-0 rounded-lg bg-amber-100 px-3 py-2 font-semibold hover:bg-amber-200 dark:bg-amber-900/50 dark:hover:bg-amber-900"
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

      <div className="space-y-3">
        {workstreamRows.map((workstream) => (
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
      </div>
    </section>
  );
}

// Kartın açık/kapalı tercihi `usePanelOpen` ile localStorage'a yazılır —
// eskiden çıplak `<details open>` kullanılıyordu, bu yüzden her sayfa
// yenilemesinde/navigasyonda kullanıcının kapattığı kart yeniden AÇIK
// başlıyordu (gerçek bug, 2026-08-10'da bildirildi). Ayrı bileşen olarak
// çıkarılma sebebi: hook'lar `workstreamRows.map()` içinde koşullu
// çağrılamaz, her departman satırının KENDİ `usePanelOpen` çağrısı olmalı.
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
  const { open, toggle } = usePanelOpen(`team-workstream-${workstream.id}`, true);
  const bodyId = `workstream-body-${workstream.id}`;

  return (
    <section
      aria-labelledby={`workstream-${workstream.id}`}
      className="rounded-2xl border border-black/10 bg-white/55 p-3 dark:border-white/10 dark:bg-white/[0.018]"
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="ui-press flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-1 text-left outline-none transition-colors hover:bg-black/[0.025] focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:bg-white/[0.04]"
      >
        <div className="flex items-center gap-2">
          <span className={`size-2.5 rounded-full ${tone.dot}`} />
          <h3
            id={`workstream-${workstream.id}`}
            className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
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
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className={`size-4 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            <path fillRule="evenodd" d="M5.22 7.47a.75.75 0 0 1 1.06 0L10 11.19l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </span>
      </button>

      {open && (
        <div
          id={bodyId}
          className="ui-enter mt-3 grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(210px,1fr))]"
        >
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
                className={`min-w-0 rounded-2xl border bg-zinc-50/80 p-2.5 dark:bg-white/[0.025] ${
                  isCurrent
                    ? "border-brand-400 ring-2 ring-brand-500/15 dark:border-brand-700"
                    : "border-black/10 dark:border-white/10"
                }`}
              >
                <header className="flex min-h-12 items-center gap-2.5 px-1">
                  <PersonAvatar
                    name={person.name}
                    avatarPath={person.avatar_path}
                    size="md"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {person.name}
                    </span>
                    <span
                      className={`mt-0.5 flex items-center gap-1.5 text-[11px] ${
                        selectedBrand
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-zinc-500 dark:text-zinc-400"
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
                        className="min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-medium outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 disabled:opacity-60 dark:border-white/15 dark:bg-zinc-900"
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
                    <div
                      className={`rounded-xl px-3 py-2.5 text-xs font-semibold uppercase tracking-wide ${hashColor(selectedBrand.name)}`}
                    >
                      {selectedBrand.name}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-black/10 px-3 py-3 text-center text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400">
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

                <div className="mt-3 space-y-2">
                  {personTasks.slice(0, 3).map((task) => (
                    <TaskGridCard key={task.id} task={task} showStatus />
                  ))}

                  {selectedBrand && personTasks.length === 0 && (
                    <div className="flex min-h-20 items-center justify-center rounded-xl border border-dashed border-black/10 bg-white/60 px-4 text-center text-xs leading-relaxed text-zinc-500 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-400">
                      Bu marka için {person.name} üzerine atanmış açık görev yok.
                    </div>
                  )}

                  {personTasks.length > 3 && (
                    <p className="rounded-lg bg-black/5 px-3 py-2 text-center text-xs font-medium text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
                      +{personTasks.length - 3} görev daha
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
