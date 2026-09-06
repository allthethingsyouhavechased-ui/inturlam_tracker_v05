import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { requireReportAccess } from "@/lib/identity";
import { todayISO } from "@/lib/date";
import { listTaskDetailReport } from "@/lib/repositories/reports";
import { drilldownRange, parseReportMetric, reportMetricRows, REPORT_METRIC_LABEL } from "@/lib/reportDrilldown";
import { parseTaskPage } from "@/lib/taskPagination";
import { TASK_STATUS_LABEL } from "@/lib/constants";
export const dynamic="force-dynamic";
export default async function ReportTasksPage({searchParams}:{searchParams:Promise<Record<string,string>>}) {
  await requireReportAccess();
  const query=new URLSearchParams(await searchParams);
  let metric,range;
  try { metric=parseReportMetric(query.get('metric')); range=drilldownRange(query); } catch { notFound(); }
  const rows=reportMetricRows(listTaskDetailReport(range,todayISO()),metric);
  const pages=Math.max(1,Math.ceil(rows.length/50)),page=Math.min(parseTaskPage(query.get('page') ?? undefined),pages);
  const pageHref=(next:number)=>{const params=new URLSearchParams(query);params.set('page',String(next));return `/reports/tasks?${params}`;};
  const back=new URLSearchParams(query); back.delete('metric');back.delete('page');
  const exported=new URLSearchParams(query);exported.delete('page');
  return <div>
    <PageHeader title={REPORT_METRIC_LABEL[metric]} breadcrumb={[{label:'Raporlar',href:`/reports?${back}`},{label:REPORT_METRIC_LABEL[metric]}]}
      description={`${rows.length} görev · ${metric==='open'||metric==='overdue' ? 'Güncel iş yükü; dönem filtresinden bağımsız.' : range ? `${range.start} – ${range.end}` : 'Tüm zamanlar'}`}
      actions={<a href={`/reports/tasks/export?${exported}`} className={buttonClass({variant:'secondary'})}>Bu görevleri Excel indir</a>} />
    <p className="mb-3 text-xs text-muted">Özetteki sayıyı oluşturan kayıtlar. Excel, aynı ölçütle eşleşen bütün sayfaları içerir.</p>
    <ul className="divide-y divide-border-subtle rounded-xl border border-border-default bg-surface">{rows.slice((page-1)*50,page*50).map(row=><li key={row.task_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div className="min-w-0"><Link href={`/tasks/${row.task_id}`} className="font-semibold text-brand-600 hover:underline">{row.title}</Link><p className="text-xs text-muted">{row.brand_name} · {row.content_title} · {row.assignee_name ?? 'Atanmamış'}</p></div><span className="text-xs text-muted">{TASK_STATUS_LABEL[row.status]}{row.archived_at ? ' · Arşiv' : ''}</span>
    </li>)}</ul>
    {rows.length===0 && <p className="py-6 text-muted">Bu ölçüt ve dönemde görev yok.</p>}
    <nav aria-label="Rapor görev sayfaları" className="mt-4 flex items-center gap-4 text-sm">{page>1&&<Link href={pageHref(page-1)}>Önceki</Link>}<span>Sayfa {page} / {pages}</span>{page<pages&&<Link href={pageHref(page+1)}>Sonraki</Link>}</nav>
  </div>;
}
