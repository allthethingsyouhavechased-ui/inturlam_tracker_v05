import Link from "next/link";
import MonthNavigator from "@/components/MonthNavigator";
import { formatPoints } from "@/lib/progress";
import { summarizePointTargets } from "@/lib/monthlyPointTargets";
import { departmentKey } from "@/lib/departments";
import { getPerson } from "@/lib/repositories/people";
import { getPersonPointTargetProgress, listMonthlyPointTargets } from "@/lib/repositories/monthlyPointTargets";

export default function MonthlyPointTargetReport({ month, basePath, personId, department, preservedQuery = "", canManage = false, canExport = false }: {
  month: string; basePath: string; personId?: string; department?: string; preservedQuery?: string; canManage?: boolean; canExport?: boolean;
}) {
  const person = personId ? getPerson(personId) : undefined;
  const rows = person ? [{ person_id: person.id, person_name: person.name, active: person.active, department: person.department, ...getPersonPointTargetProgress(person.id, month) }]
    : listMonthlyPointTargets(month).filter(row => !department || departmentKey(row.department) === department);
  const summary = summarizePointTargets(rows);
  const query = new URLSearchParams({ view: "targets", month });
  if (personId) query.set("person", personId);
  if (department) query.set("department", department);
  return (
    <section aria-label="Aylık kişisel hedefler" className="my-5 overflow-hidden rounded-xl border border-border-default bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle p-4">
        <div>
          <h2 className="text-base font-semibold">Aylık kişisel hedefler</h2>
          <p className="mt-1 text-xs text-muted">{month} · Tam ayın katkısı; atanan iş miktarından bağımsız hedef.</p>
          {rows.length > 1 && <p className="mt-2 text-sm font-medium">{summary.percent === null ? "Hedef tanımlanmadı" : `Toplam ${formatPoints(summary.earned_points)} / ${formatPoints(summary.target_points)} puan · %${summary.percent}`}
            <span className="ml-2 text-xs text-muted">{summary.reached_count} kişi hedefini tamamladı{summary.missing_count > 0 ? ` · ${summary.missing_count} kişinin hedefi eksik (toplam orana dahil değil)` : ""}</span>
          </p>}
        </div>
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <MonthNavigator month={month} basePath={basePath} preservedQuery={preservedQuery} scroll={false} ariaLabel="Kişisel hedef rapor ayı" />
          {canManage && <Link className="text-xs font-semibold text-brand-600 hover:underline" href={`/team/manage/targets?month=${month}`}>Hedefleri düzenle</Link>}
          {canExport && <a className="text-xs font-semibold text-brand-600 hover:underline" href={`/reports/export?${query}`}>Hedefleri Excel indir</a>}
        </div>
      </div>
      <div className="divide-y divide-border-subtle">
        {rows.map(row => <div key={row.person_id} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
          <div><Link href={`/team/${row.person_id}?month=${month}`} className="text-sm font-semibold hover:underline">{row.person_name}</Link>
            <p className="mt-1 text-xs text-muted">Atanan: {formatPoints(row.assigned_points)} puan{row.active ? "" : " · Pasif"}</p></div>
          <p className="text-sm font-semibold tabular-nums">{formatPoints(row.earned_points)} / {row.target_points === null ? "—" : formatPoints(row.target_points)} puan
            {row.percent !== null && <span className="ml-2 text-brand-600 dark:text-brand-300">%{row.percent}</span>}</p>
          <p className="text-xs text-secondary sm:min-w-36 sm:text-right">{row.target_points === null ? "Hedef tanımlanmadı" : row.extra_points! > 0 ? `Hedef üstü +${formatPoints(row.extra_points!)} puan` : row.remaining_points === 0 ? "Hedef tamamlandı" : `${formatPoints(row.remaining_points!)} puan kaldı`}</p>
        </div>)}
        {!rows.length && <p className="p-4 text-sm text-muted">Bu kapsamda ekip üyesi yok.</p>}
      </div>
      <p className="border-t border-border-subtle p-4 text-xs text-muted">Kişilerin yükümlülükleri ayrı izlenir. Bir kişinin fazla katkısı diğerinin eksik hedefini tamamlamaz. Puanlar iç teslim ayı ve görev durumuna göre kazanılır.</p>
    </section>
  );
}
