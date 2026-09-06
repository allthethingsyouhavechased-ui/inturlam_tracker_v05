import type { TaskDetailRow } from "@/lib/repositories/reports";
import { currentMonthRange, currentWeekRange } from "@/lib/date";

export const REPORT_METRIC_LABEL = { opened: "Dönemde açılan", completed: "Tamamlanan", open: "Açık iş", overdue: "Geciken" } as const;
export type ReportMetric = keyof typeof REPORT_METRIC_LABEL;
export function parseReportMetric(value: string | null): ReportMetric {
  if (!value || !Object.hasOwn(REPORT_METRIC_LABEL,value)) throw new Error("Geçersiz rapor ölçütü.");
  return value as ReportMetric;
}
export function reportMetricRows(rows: TaskDetailRow[], metric: ReportMetric): TaskDetailRow[] {
  return rows.filter(row => metric === "opened" ? row.opened_in_period === 1 : metric === "completed" ? row.completed_in_period === 1 : metric === "overdue" ? row.overdue === 1 : row.status !== "Yayinlandi");
}
export function drilldownRange(query: URLSearchParams) {
  const key=query.get("range");
  if(key === "week") return currentWeekRange();
  if(key === "month") return currentMonthRange();
  if(key !== "custom") return null;
  const start=query.get("start") ?? "",end=query.get("end") ?? "";
  const valid=(date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10)===date;
  if(!valid(start) || !valid(end) || start>end) throw new Error("Geçerli bir başlangıç ve bitiş tarihi seçin.");
  return {start,end};
}
