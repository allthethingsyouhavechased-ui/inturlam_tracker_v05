"use client";

// Üç rapor ekranının (portföy / kişi / departman) ortak yapı taşları.
// `MetricCard` ile biçimlendiriciler önce portföy raporunda yazılmış, sonra
// kişi raporuna BİREBİR kopyalanmıştı; departman raporu üçüncü kopyayı
// üretmesin diye tek dosyaya alındı. Görsel çıktı değişmedi.

import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import { brandAccentStyle } from "@/lib/brandAccent";
import CollapsiblePanel from "@/components/reports/CollapsiblePanel";
import {
  REPORT_SURFACE_CLASS,
  TASK_PRIORITY_DOT,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_PROGRESS,
} from "@/lib/constants";
import type { PriorityReportRow, WorkflowReportRow } from "@/lib/repositories/reports";
import type { TaskWithContext } from "@/lib/types";
export { comparePeriod } from "@/lib/periodComparison";

export function formatRate(value: number | null): string {
  return value == null ? "—" : `%${Math.round(value)}`;
}

export function formatDays(value: number | null): string {
  return value == null ? "—" : `${value.toLocaleString("tr-TR")} gün`;
}

// Sayının yanında her zaman bir cümle: rapor "anlaşılır" olsun diye rakamın
// ne anlama geldiği okuyucunun yorumuna bırakılmıyor.
export function MetricCard({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  note: string;
  tone?: "neutral" | "success" | "danger";
}) {
  const dotClass =
    tone === "success" ? "bg-emerald-500" : tone === "danger" ? "bg-rose-500" : "bg-brand-500";
  const surface =
    tone === "success"
      ? "border-t-emerald-500 bg-emerald-50/35 dark:bg-emerald-950/10"
      : tone === "danger"
        ? "border-t-rose-500 bg-rose-50/45 dark:bg-rose-950/10"
        : "border-t-brand-500 bg-white dark:bg-zinc-900";

  return (
    <div className={`min-w-0 border-t-2 px-4 py-4 sm:px-5 ${surface}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        </div>
        <span className={`mt-1 size-2.5 shrink-0 rounded-full ${dotClass}`} aria-hidden="true" />
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{note}</p>
    </div>
  );
}

export function ShareBar({
  label,
  percentage,
  detail,
  tone = "neutral",
}: {
  label: string;
  percentage: number;
  detail: string;
  tone?: "neutral" | "success";
}) {
  return (
    <div className={`${REPORT_SURFACE_CLASS} p-4`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
        <p className="text-lg font-semibold tabular-nums">%{percentage}</p>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
      >
        <div
          className={`h-full rounded-full ${tone === "success" ? "bg-emerald-500" : "bg-brand-500"}`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{detail}</p>
    </div>
  );
}

// Departman raporunda aynı listede birden çok kişinin işi var; `showAssignee`
// ile satırın alt metnine sorumlu adı ekleniyor (kişi raporunda gereksiz).
export function TaskRow({
  task,
  trailing,
  showAssignee = false,
}: {
  task: TaskWithContext;
  trailing: React.ReactNode;
  showAssignee?: boolean;
}) {
  return (
    <li>
      <Link
        href={`/tasks/${task.id}`}
        className="flex items-start justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
      >
        <span className="flex min-w-0 items-start gap-2">
          <span
            className={`mt-1.5 size-2 shrink-0 rounded-full ${TASK_PRIORITY_DOT[task.priority]}`}
            aria-hidden="true"
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{task.title}</span>
            <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
              {showAssignee ? `${task.assignee_name ?? "Atanmamış"} · ` : ""}
              {task.brand_name} · {task.content_title} ·{" "}
              {TASK_PRIORITY_LABEL[task.priority]}
            </span>
          </span>
        </span>
        <span className="shrink-0 text-right text-xs tabular-nums">{trailing}</span>
      </Link>
    </li>
  );
}

export function TaskListPanel({
  panelKey,
  title,
  description,
  count,
  emptyTitle,
  emptyDescription,
  children,
}: {
  panelKey: string;
  title: string;
  description: string;
  count: number;
  emptyTitle: string;
  emptyDescription: string;
  children: React.ReactNode;
}) {
  return (
    <CollapsiblePanel
      panelKey={panelKey}
      title={title}
      description={description}
      meta={<span className="tabular-nums">{count} görev</span>}
    >
      {count === 0 ? (
        <EmptyState compact title={emptyTitle} description={emptyDescription} />
      ) : (
        <ul className="-mx-3 divide-y divide-black/5 dark:divide-white/5">{children}</ul>
      )}
    </CollapsiblePanel>
  );
}

// ---- Kişi ve departman raporunun ortak dağılım kartları ----
// Üçü de iki ekranda birebir aynıydı; kapsamı anlatan tek bir cümle
// (`description` / `emptyDescription`) dışında fark yok.

export function WorkflowBreakdownPanel({
  workflow,
  description,
  emptyDescription,
}: {
  workflow: WorkflowReportRow[];
  description: string;
  emptyDescription: string;
}) {
  const total = workflow.reduce((sum, row) => sum + row.task_count, 0);
  return (
    <CollapsiblePanel
      panelKey="scope-workflow"
      title="Açık işler hangi aşamada"
      description={description}
      meta={<span className="tabular-nums">{total} açık</span>}
    >
      {total === 0 ? (
        <EmptyState compact title="Açık iş yok" description={emptyDescription} />
      ) : (
        <div className="space-y-3">
          {workflow.map((row) => (
            <div key={row.status}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium">{TASK_STATUS_LABEL[row.status]}</span>
                <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                  {row.task_count}
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10"
                role="progressbar"
                aria-label={`${TASK_STATUS_LABEL[row.status]} görevleri`}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={row.task_count}
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${TASK_STATUS_PROGRESS[row.status]}`}
                  style={{ width: `${(row.task_count / total) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </CollapsiblePanel>
  );
}

export function PriorityBreakdownPanel({ priorities }: { priorities: PriorityReportRow[] }) {
  const total = priorities.reduce((sum, row) => sum + row.open_tasks, 0);
  return (
    <CollapsiblePanel
      panelKey="scope-priority"
      title="Açık işlerin önceliği"
      description="Yoğunluğun ne kadarı gerçekten acil"
      meta={<span className="tabular-nums">{total} açık</span>}
    >
      {total === 0 ? (
        <EmptyState
          compact
          title="Açık iş yok"
          description="Öncelik dağılımı açık görev oluştuğunda görünecek."
        />
      ) : (
        <div className="space-y-3">
          {priorities.map((row) => (
            <div key={row.priority}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2 font-medium">
                  <span
                    className={`size-2 rounded-full ${TASK_PRIORITY_DOT[row.priority]}`}
                    aria-hidden="true"
                  />
                  {TASK_PRIORITY_LABEL[row.priority]}
                </span>
                <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                  {row.open_tasks}
                  {row.overdue_tasks > 0 && (
                    <span className="ml-1 text-danger">
                      · {row.overdue_tasks} geciken
                    </span>
                  )}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                <div
                  className={`h-full rounded-full ${TASK_PRIORITY_DOT[row.priority]}`}
                  style={{ width: `${(row.open_tasks / total) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </CollapsiblePanel>
  );
}

export interface ScopeBrandRow {
  brand_id: string;
  brand_name: string;
  brand_accent_hue: number;
  completed_tasks: number;
  open_tasks: number;
}

export function BrandBreakdownPanel({
  brands,
  emptyDescription,
}: {
  brands: ScopeBrandRow[];
  emptyDescription: string;
}) {
  const maxTotal = Math.max(1, ...brands.map((brand) => brand.open_tasks + brand.completed_tasks));
  return (
    <CollapsiblePanel
      panelKey="scope-brands"
      title="Hangi markalara çalışıyor"
      description="Seçili dönemdeki dağılım — tamamlanan ve açık işler"
      meta={<span className="tabular-nums">{brands.length} marka</span>}
    >
      {brands.length === 0 ? (
        <EmptyState compact title="Marka dağılımı yok" description={emptyDescription} />
      ) : (
        <div className="space-y-3">
          {brands.map((brand) => {
            const total = brand.open_tasks + brand.completed_tasks;
            return (
              <div
                key={brand.brand_id}
                data-brand-accent
                style={brandAccentStyle(brand.brand_accent_hue)}
                className="brand-stripe rounded-r-lg px-2 py-1"
              >
                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                  <Link
                    href={`/brands/${brand.brand_id}`}
                    className="truncate font-medium hover:text-brand-600 hover:underline dark:hover:text-brand-400"
                  >
                    {brand.brand_name}
                  </Link>
                  <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
                    {brand.completed_tasks} tamamlanan · {brand.open_tasks} açık
                  </span>
                </div>
                <div
                  className="flex h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10"
                  style={{ width: `${(total / maxTotal) * 100}%`, minWidth: "8%" }}
                >
                  <span
                    className="bg-emerald-500"
                    style={{ width: `${total === 0 ? 0 : (brand.completed_tasks / total) * 100}%` }}
                  />
                  <span
                    className="bg-brand-500"
                    style={{ width: `${total === 0 ? 0 : (brand.open_tasks / total) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
          <p className="pt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span className="mr-1 inline-block size-2 rounded-full bg-emerald-500 align-middle" />
            tamamlanan
            <span className="ml-3 mr-1 inline-block size-2 rounded-full bg-brand-500 align-middle" />
            açık
          </p>
        </div>
      )}
    </CollapsiblePanel>
  );
}

export function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T12:00:00`).getTime();
  const to = new Date(`${toISO}T12:00:00`).getTime();
  return Math.round((to - from) / 86_400_000);
}

/**
 * Üç rapor bölümünün (departman / kişi / marka) ortak başlığı: başlık + açıklama
 * solda, tabloyu aç-kapa ve CSV sağda. Üçü bir dönem bu ~30 satırı birebir
 * kopyalıyordu; buton yüksekliği ya da hover tonu birinde değişince diğer ikisi
 * sessizce ayrışıyordu.
 */
export function ReportSectionHeader({
  title,
  description,
  tableVisible,
  onToggleTable,
  onExportCSV,
  extra,
}: {
  title: string;
  description: string;
  tableVisible: boolean;
  onToggleTable: () => void;
  onExportCSV: () => void;
  /** Bölüme özel ek kontrol (ör. marka görünümündeki "Arşivi gizle"). */
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-h2">{title}</h2>
        <p className="text-sm text-muted">{description}</p>
      </div>
      <div className="flex items-center gap-1.5">
        {extra}
        <button
          type="button"
          onClick={onToggleTable}
          aria-expanded={tableVisible}
          className="ui-press inline-flex min-h-9 items-center rounded-md border border-brand-500/30 bg-brand-500/[0.06] px-3 text-sm font-medium text-brand-700 hover:bg-brand-500/15 dark:text-brand-300"
        >
          {tableVisible ? "Tabloyu gizle" : "Tabloyu göster"}
        </button>
        <button
          type="button"
          onClick={onExportCSV}
          className="ui-press inline-flex min-h-9 items-center gap-2 rounded-md border border-brand-500/30 bg-brand-500/[0.06] px-3 text-sm font-medium text-brand-700 hover:bg-brand-500/15 dark:text-brand-300"
        >
          CSV
        </button>
      </div>
    </div>
  );
}
