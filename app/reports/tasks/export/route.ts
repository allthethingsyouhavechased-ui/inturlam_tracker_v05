import { getCurrentPerson } from "@/lib/identity";
import { todayISO } from "@/lib/date";
import { listTaskDetailReport } from "@/lib/repositories/reports";
import { drilldownRange, parseReportMetric, reportMetricRows, REPORT_METRIC_LABEL } from "@/lib/reportDrilldown";
import { buildXlsx } from "@/lib/xlsx";
import { TASK_STATUS_LABEL } from "@/lib/constants";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  const actor=await getCurrentPerson();
  if(!actor) return new Response('Oturum gerekli.',{status:401});
  if(actor.is_manager!==1) return new Response('Yetki gerekli.',{status:403});
  const query=new URL(request.url).searchParams;
  let metric,range;
  try { metric=parseReportMetric(query.get('metric')); range=drilldownRange(query); } catch { return new Response('Geçersiz ölçüt veya tarih.',{status:400}); }
  const rows=reportMetricRows(listTaskDetailReport(range,todayISO()),metric);
  const bytes=buildXlsx([{name:REPORT_METRIC_LABEL[metric],columns:['Görev kimliği','Görev','Marka','İçerik','Sorumlu','Durum','İç teslim','Açılma','Tamamlanma'].map(header=>({header})),rows:rows.map(row=>[row.task_id,row.title,row.brand_name,row.content_title,row.assignee_name,TASK_STATUS_LABEL[row.status],row.due_date,row.created_at,row.completed_at])}]);
  return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="rapor-${metric}.xlsx"`,'Cache-Control':'no-store'}});
}
