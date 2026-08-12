"use client";

import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import Icon from "@/components/ui/Icon";
import { TASK_STATUS_LABEL } from "@/lib/constants";
import type { TaskContribution } from "@/lib/repositories/progress";
import { usePanelOpen } from "@/lib/usePanelOpen";
import type { MonthlyProgress, PersonBrandAssignment } from "@/lib/types";

type AssignedBrandProgress = PersonBrandAssignment & { progress: MonthlyProgress };

function DockButton({
  label,
  value,
  icon,
  open,
  controls,
  onClick,
}: {
  label: string;
  value: string;
  icon: "brands" | "tasks";
  open: boolean;
  controls: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-controls={controls}
      className={`ui-press inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border bg-surface px-3 text-left shadow-sm hover:bg-surface-hover ${open ? "border-brand-400 ring-1 ring-brand-500/15" : "border-border-default"}`}
    >
      <Icon name={icon} className="size-4 text-brand-500" />
      <span className="truncate text-xs font-semibold text-foreground">{label}</span>
      <span className="rounded-full bg-surface-subtle px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted">{value}</span>
      <span className="text-[11px] font-medium text-brand-600 dark:text-brand-300">{open ? "Kapat" : "Aç"}</span>
    </button>
  );
}

export default function PanomInsightPanels({
  personId,
  assignedBrands,
  monthlyProgress,
  contributions,
}: {
  personId: string;
  assignedBrands: AssignedBrandProgress[];
  monthlyProgress: MonthlyProgress;
  contributions: TaskContribution[];
}) {
  const brandsPanel = usePanelOpen(`panom-brands:${personId}`, false);
  const contributionPanel = usePanelOpen(`panom-contribution:${personId}`, false);
  const brandsId = `panom-brands-${personId}`;
  const contributionId = `panom-contribution-${personId}`;

  return (
    <div className="contents">
      <DockButton
        label="Üzerimdeki markalar"
        value={String(assignedBrands.length)}
        icon="brands"
        open={brandsPanel.open}
        controls={brandsId}
        onClick={brandsPanel.toggle}
      />
      <DockButton
        label="Bu ayki katkım"
        value={monthlyProgress.percent === null ? "Plan yok" : `%${monthlyProgress.percent}`}
        icon="tasks"
        open={contributionPanel.open}
        controls={contributionId}
        onClick={contributionPanel.toggle}
      />

      {brandsPanel.open && (
        <section id={brandsId} className="ui-enter order-last w-full basis-full overflow-hidden rounded-xl border border-border-default bg-surface">
          <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 sm:px-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Üzerimdeki markalar</h2>
              <p className="mt-0.5 text-xs text-muted">Bu ayın marka bazlı ağırlıklı ilerlemesi.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold tabular-nums text-muted">{assignedBrands.length} marka</span>
              <Link href="/panom/markalar" className="ui-press inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/40">
                Detaylı analiz <Icon name="arrow-right" className="size-3.5" />
              </Link>
            </div>
          </div>
          {assignedBrands.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3">
              {assignedBrands.map((brand, index) => (
                <Link key={brand.brand_id} href={`/brands/${brand.brand_id}`} className={`group min-w-0 px-4 py-3.5 hover:bg-surface-hover ${index > 0 ? "border-t border-border-subtle" : ""} sm:[&:nth-child(2)]:border-t-0 sm:[&:nth-child(even)]:border-l lg:[&:nth-child(3)]:border-t-0 lg:[&:nth-child(3n)]:border-l`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <BrandLogo name={brand.brand_name} logoPath={brand.brand_logo_path} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-300">{brand.brand_name}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted">{brand.progress.percent === null ? "Plan yok" : `%${brand.progress.percent}`}</span>
                      </div>
                      {brand.progress.percent !== null && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-subtle"><div className="h-full rounded-full bg-brand-600" style={{ width: `${brand.progress.percent}%` }} /></div>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : <p className="px-5 py-8 text-center text-sm text-muted">Henüz marka ataması yapılmadı.</p>}
        </section>
      )}

      {contributionPanel.open && (
        <section id={contributionId} className="ui-enter order-last w-full basis-full overflow-hidden rounded-xl border border-border-default bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 sm:px-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Bu ayki katkım</h2>
              <p className="mt-0.5 text-xs text-muted">Durum katsayısı ve görev ağırlığına göre hesaplanır.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold tabular-nums text-foreground">{monthlyProgress.percent === null ? "Bu ay plan yok" : `%${monthlyProgress.percent}`}</span>
              <Link href="/panom/katkim" className="ui-press inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/40">
                Detaylı analiz <Icon name="arrow-right" className="size-3.5" />
              </Link>
            </div>
          </div>
          {contributions.length > 0 ? (
            <div className="divide-y divide-border-subtle">
              {contributions.slice(0, 6).map((task) => (
                <Link key={task.id} href={`/tasks/${task.id}`} className="flex min-w-0 items-center justify-between gap-3 px-4 py-2.5 text-xs hover:bg-surface-hover sm:px-5">
                  <span className="min-w-0 truncate text-secondary"><strong className="font-semibold text-foreground">{task.brand_name}</strong> · {task.title}</span>
                  <span className="shrink-0 tabular-nums text-muted">{TASK_STATUS_LABEL[task.status]} · {task.contribution_points}/{task.weight_points}</span>
                </Link>
              ))}
              {contributions.length > 6 && <p className="px-5 py-2.5 text-right text-[11px] text-muted">+{contributions.length - 6} görev daha</p>}
            </div>
          ) : <p className="px-5 py-8 text-center text-sm text-muted">Bu ay teslim tarihli görevin bulunmuyor.</p>}
        </section>
      )}
    </div>
  );
}
