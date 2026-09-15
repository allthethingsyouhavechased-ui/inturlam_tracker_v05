"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import PersonAvatar from "@/components/PersonAvatar";
import Icon from "@/components/ui/Icon";
import { setActiveBrandAction } from "@/lib/actions/activeWork";
import { readTeamWorkstream, rememberTeamWorkstream } from "@/lib/uiPreferences";
import { brandAccentStyle } from "@/lib/brandAccent";
import {
  groupPeopleByDepartment,
  type DepartmentKey,
  type DepartmentRow,
} from "@/lib/departments";
import type {
  PersonTaskPreview,
  PersonTaskWorkSummary,
} from "@/lib/repositories/activeWork";
import type { Brand, Person, PersonActiveWork, PersonBrandAssignment } from "@/lib/types";
import { setPersonBrandAssignmentAction } from "@/lib/actions/people";
import { TASK_STATUS_LABEL, TASK_STATUS_DOT } from "@/lib/constants";

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
    badge: "bg-sky-500/10 text-info",
  },
  design: {
    dot: "bg-violet-500",
    badge: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  social: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/10 text-success",
  },
  management: {
    dot: "bg-amber-500",
    badge: "bg-amber-500/10 text-warning",
  },
  other: {
    dot: "bg-zinc-400",
    badge: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
  },
};

// `useSyncExternalStore` bir abonelik istiyor; tercih yalnizca bu bilesenin
// kendi tiklamasiyla degistigi icin dinlenecek harici bir olay yok.
const subscribeWorkstream = () => () => {};
export default function ActiveWorkBoard({
  people,
  brands,
  selections,
  taskSummaries,
  taskPreviews,
  currentPersonId,
  assignments,
  canManageAssignments = false,
}: {
  people: Person[];
  brands: Brand[];
  selections: PersonActiveWork[];
  taskSummaries: PersonTaskWorkSummary[];
  taskPreviews: PersonTaskPreview[];
  currentPersonId: string | null;
  /** Kalıcı marka sorumlulukları (person_brand_assignments) — "şu an çalışılan
      marka" ile aynı şey DEĞİL; kartta ayrı satırda gösteriliyor. */
  assignments: PersonBrandAssignment[];
  canManageAssignments?: boolean;
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
  // Seçim KALICI: kullanıcı "Tümü"ye geçtiyse sayfadan çıkıp dönünce yine
  // "Tümü" görsün. Depoda kayıt yoksa kişinin kendi departmanına düşer.
  // Sunucu anlık görüntüsü daima varsayılan olduğu için SSR çıktısı sabit;
  // hatırlanan seçim hydration'dan sonra uygulanıyor (bkz. CollapsiblePanel).
  const storedWorkstreamId = useSyncExternalStore(
    subscribeWorkstream,
    readTeamWorkstream,
    () => null,
  );
  const [override, setOverride] = useState<DepartmentKey | "all" | null>(null);
  const fallbackWorkstreamId = currentWorkstreamId ?? workstreamRows[0]?.id ?? "all";
  const knownIds = new Set<string>(["all", ...workstreamRows.map((row) => row.id)]);
  const selectedWorkstreamId: DepartmentKey | "all" = override
    ?? (storedWorkstreamId && knownIds.has(storedWorkstreamId)
      ? (storedWorkstreamId as DepartmentKey | "all")
      : fallbackWorkstreamId);

  function chooseWorkstream(next: DepartmentKey | "all") {
    setOverride(next);
    rememberTeamWorkstream(next);
    setQuery("");
  }
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
    <section className="space-y-3" aria-label="Aktif çalışma dağılımı">
      {/* "KAPASİTE / Aktif çalışma dağılımı" başlık bloğu kaldırıldı: sayfa
          başlığı (PageHeader) zaten aynı şeyi söylüyordu, alt satırlar
          ("…15 saniye içinde görünür") ise uygulama detayıydı ve kalıcı yer
          tutuyordu. Bölümün erişilebilir adı `aria-labelledby` yerine artık
          doğrudan `aria-label`da (aşağıdaki filtre bölümünde). */}
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
            onClick={() => chooseWorkstream("all")}
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
              onClick={() => chooseWorkstream(row.id)}
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
            taskSummaries={taskSummaries}
            taskPreviews={taskPreviews}
            selectedBrandId={selectedBrandId}
            pending={pending}
            changeBrand={changeBrand}
            assignments={assignments}
            canManageAssignments={canManageAssignments}
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
  taskSummaries,
  taskPreviews,
  selectedBrandId,
  pending,
  changeBrand,
  assignments,
  canManageAssignments,
}: {
  workstream: DepartmentRow<Person>;
  tone: { dot: string; badge: string };
  currentPersonId: string | null;
  selections: PersonActiveWork[];
  brands: Brand[];
  taskSummaries: PersonTaskWorkSummary[];
  taskPreviews: PersonTaskPreview[];
  selectedBrandId: string;
  pending: boolean;
  changeBrand: (nextBrandId: string) => void;
  assignments: PersonBrandAssignment[];
  canManageAssignments: boolean;
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
            const taskSummary = taskSummaries.find(
              (summary) => summary.person_id === person.id,
            ) ?? { person_id: person.id, open_count: 0, overdue_count: 0, all_count: 0, archived_count: 0 };
            const personTasks = taskPreviews.filter(
              (task) => task.person_id === person.id,
            );

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
                          ? "text-success"
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

                <div className="mt-2 flex gap-1.5 px-1 text-[10px] font-semibold tabular-nums">
                  <span className="rounded-md bg-surface-muted px-2 py-1 text-secondary">
                    {taskSummary.open_count} açık iş
                  </span>
                  {taskSummary.overdue_count > 0 && (
                    <span className="rounded-md bg-rose-50 px-2 py-1 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                      {taskSummary.overdue_count} geciken
                    </span>
                  )}
                </div>

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

                <PersonBrandResponsibilities
                  personId={person.id}
                  personName={person.name}
                  brands={brands}
                  assignments={assignments.filter((item) => item.person_id === person.id)}
                  canManage={canManageAssignments}
                />

                <PersonTaskList
                  personId={person.id}
                  tasks={personTasks}
                  summary={taskSummary}
                />
              </article>
            );
          })}
      </div>
    </section>
  );
}

// "Sorumlu olduğu markalar": KALICI atama (person_brand_assignments). Kartın
// üstündeki "Şu anda çalıştığım marka" ile karıştırılmasın diye ayrı başlıkta
// ve ayrı görsel dilde duruyor. Kaynak marka sayfasındakiyle AYNI tablo —
// ikinci bir atama sistemi kurulmadı.
function PersonBrandResponsibilities({
  personId,
  personName,
  brands,
  assignments,
  canManage,
}: {
  personId: string;
  personName: string;
  brands: Brand[];
  assignments: PersonBrandAssignment[];
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const assignedIds = new Set(assignments.map((item) => item.brand_id));

  function toggle(brandId: string, assigned: boolean) {
    setError(null);
    startTransition(async () => {
      // Yalnız BU kişinin ilişkisi yazılır; aynı markanın diğer sorumluları
      // ve eski görevlerin sorumlusu değişmez.
      const result = await setPersonBrandAssignmentAction(personId, brandId, assigned);
      if (!result.ok) { setError(result.error); return; }
      router.refresh();
    });
  }

  return (
    <div className="mt-3 rounded-[9px] border border-border-subtle bg-surface px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          Sorumlu olduğu markalar
        </p>
        {canManage && (
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            aria-expanded={editing}
            className="touch-target text-[10px] font-semibold text-brand-600 hover:underline dark:text-brand-300"
          >
            {editing ? "Bitir" : "Düzenle"}
          </button>
        )}
      </div>

      {assignments.length === 0 ? (
        <p className="mt-1 text-[11px] text-muted">Kalıcı marka sorumluluğu tanımlı değil.</p>
      ) : (
        <ul className="mt-1.5 flex flex-wrap gap-1">
          {assignments.map((item) => (
            <li key={item.brand_id}>
              <Link
                href={`/brands/${item.brand_id}`}
                className="inline-flex rounded-md bg-surface-muted px-2 py-1 text-[10px] font-medium text-secondary hover:bg-surface-hover"
              >
                {item.brand_name}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <fieldset disabled={pending} className="mt-2 max-h-40 overflow-y-auto rounded-[8px] border border-border-subtle p-1.5">
          <legend className="sr-only">{personName} için marka sorumlulukları</legend>
          {brands.map((brand) => (
            <label key={brand.id} className="flex min-h-9 items-center gap-2 px-1 text-[11px] text-secondary">
              <input
                type="checkbox"
                checked={assignedIds.has(brand.id)}
                onChange={(event) => toggle(brand.id, event.target.checked)}
                className="size-3.5"
              />
              <span className="truncate">{brand.name}</span>
            </label>
          ))}
        </fieldset>
      )}
      {error && <p role="alert" className="mt-1 text-[10px] text-danger">{error}</p>}
    </div>
  );
}

// Kartın görev listesi. Varsayılan "Açık"; "Tümü" yayınlananları da katar.
// "+N görev daha" artık klavyeyle kullanılabilir gerçek bir düğme ve gösterdiği
// sayı GERÇEKTEN gizli kalan kayıt sayısı — önizleme sınırı da hesaba katılıyor.
function PersonTaskList({
  personId,
  tasks,
  summary,
}: {
  personId: string;
  tasks: PersonTaskPreview[];
  summary: PersonTaskWorkSummary;
}) {
  const [scope, setScope] = useState<"open" | "all">("open");
  const [expanded, setExpanded] = useState(false);

  const scoped = scope === "open" ? tasks.filter((task) => task.is_open === 1) : tasks;
  const total = scope === "open" ? summary.open_count : summary.all_count;
  const visible = expanded ? scoped : scoped.slice(0, 2);
  const hidden = Math.max(0, total - visible.length);
  // Açık kapsamda liste "açık görevler" odağıyla, Tümü'de odaksız açılıyor —
  // odak değeri lib/taskFocus.ts'teki kümeden, uydurma bir değer değil.
  const listHref = scope === "open"
    ? `/tasks?assignee=${encodeURIComponent(personId)}&focus=open`
    : `/tasks?assignee=${encodeURIComponent(personId)}`;

  return (
    <div className="mt-3 space-y-1">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div role="group" aria-label="Görev kapsamı" className="flex gap-1">
          {(["open", "all"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => { setScope(value); setExpanded(false); }}
              aria-pressed={scope === value}
              className={`touch-target rounded-md px-2 text-[10px] font-semibold ${
                scope === value ? "bg-brand-600 text-white" : "text-secondary hover:bg-surface-hover"
              }`}
            >
              {value === "open" ? `Açık · ${summary.open_count}` : `Tümü · ${summary.all_count}`}
            </button>
          ))}
        </div>
        {summary.archived_count > 0 && (
          <Link
            href="/tasks/archive"
            className="text-[10px] font-medium text-muted hover:text-secondary hover:underline"
          >
            Arşiv · {summary.archived_count}
          </Link>
        )}
      </div>

      {visible.map((task) => (
        <Link
          key={task.task_id}
          href={`/tasks/${task.task_id}`}
          data-brand-accent
          style={brandAccentStyle(task.brand_accent_hue)}
          className="brand-stripe flex min-h-9 items-center gap-2 rounded-r-[8px] border border-border-subtle bg-surface px-2.5 text-[11px] text-secondary hover:border-border-strong hover:text-foreground"
        >
          <span className="min-w-0 flex-1 py-1">
            <span className="block truncate font-medium">{task.title}</span>
            <span className="flex items-center gap-1.5 truncate text-[10px] text-muted">
              <span className={`size-1.5 shrink-0 rounded-full ${TASK_STATUS_DOT[task.status]}`} />
              <span className="truncate">
                {task.brand_name} · {TASK_STATUS_LABEL[task.status]}
                {task.due_date ? ` · ${task.due_date}` : ""}
              </span>
            </span>
          </span>
        </Link>
      ))}

      {total === 0 && (
        <div className="rounded-[9px] border border-dashed border-border-subtle px-3 py-2 text-center text-[11px] text-muted">
          {scope === "open" ? "Açık görev yok." : "Görev yok."}
        </div>
      )}

      {hidden > 0 && (
        expanded || visible.length >= scoped.length ? (
          <Link
            href={listHref}
            className="block rounded-lg bg-surface-muted px-3 py-1.5 text-center text-[11px] font-medium text-secondary hover:bg-surface-hover"
          >
            Kalan {hidden} görevi listede aç
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-expanded={false}
            className="ui-press block w-full rounded-lg bg-surface-muted px-3 py-1.5 text-center text-[11px] font-medium text-secondary hover:bg-surface-hover"
          >
            +{hidden} görev daha
          </button>
        )
      )}
    </div>
  );
}
