import { getDb, plainList, plainOne } from "@/lib/db/client";
import { NO_DEPARTMENT, type DepartmentKey } from "@/lib/departments";
import {
  departmentBucketExpression,
  departmentPeopleCondition,
} from "@/lib/repositories/people";
import type { TaskPriority, TaskStatus } from "@/lib/types";
import { plannedTaskCondition, visibleContentCondition } from "@/lib/taskPlanning";

const IS_PLANNED = plannedTaskCondition("t");

export interface DateRange {
  start: string;
  end: string;
}

// Raporların çoğu üç kapsamda birden çalışıyor: portföy geneli (`null`), tek
// kişi (kişi id'si) ve tek departman (`{ department }`). Aynı SQL'i üç kez
// yazmamak için tüm sayaç fonksiyonları bu isteğe bağlı parametreyi alıyor.
//
// Departman kapsamı `people.department` üzerinden DOLAYLI çalışır (bkz.
// `departmentPeopleCondition`): atanmamış görevler hiçbir departmana sayılmaz.
export type ReportScope = string | { department: DepartmentKey } | null;

/** Departman kapsamını okunur biçimde kurmak için — `scope(departmentScope("video"))`. */
export function departmentScope(department: DepartmentKey): ReportScope {
  return { department };
}

function isDepartmentScope(scope: ReportScope): scope is { department: DepartmentKey } {
  return typeof scope === "object" && scope !== null;
}

// Kapsam koşulunun kendisi (AND/WHERE eki olmadan). `column` çağıranın
// sorgusundaki atanan sütununun tam adı — `getTrendReport`'un alt sorgusunda
// tablo takma adı yok, orası `assignee_id` geçiyor.
function scopeExpression(scope: ReportScope, column = "t.assignee_id"): string | null {
  if (!scope) return null;
  if (isDepartmentScope(scope)) return departmentPeopleCondition(scope.department, column);
  return `${column} = :personId`;
}

function scopeCondition(scope: ReportScope, column = "t.assignee_id"): string {
  const expression = scopeExpression(scope, column);
  return expression ? `AND ${expression}` : "";
}

function scopeParams(
  scope: ReportScope,
): { personId: string } | { department: string } | undefined {
  if (!scope) return undefined;
  if (isDepartmentScope(scope)) {
    // "Diğer" kovasının koşulu sabit bir NOT IN listesi — bağlanacak değer yok.
    return scope.department === NO_DEPARTMENT ? undefined : { department: scope.department };
  }
  return { personId: scope };
}

export interface ReportSummary {
  opened_tasks: number;
  completed_tasks: number;
  open_tasks: number;
  overdue_tasks: number;
  on_time_rate: number | null;
  average_cycle_days: number | null;
}

export interface WorkflowReportRow {
  status: Exclude<TaskStatus, "Yayinlandi">;
  task_count: number;
}

export interface PersonReportRow {
  person_id: string;
  person_name: string;
  department: string | null;
  // Departman raporundaki kişi tablosu avatar gösteriyor; ayrı bir kişi sorgusu
  // açmamak için satırla birlikte geliyor.
  avatar_path: string | null;
  active: number;
  total_tasks: number;
  completed_tasks: number;
  open_tasks: number;
  overdue_tasks: number;
  on_time_rate: number | null;
  average_cycle_days: number | null;
}

export interface PersonBrandRow {
  person_id: string;
  brand_id: string;
  brand_name: string;
  total_tasks: number;
  completed_tasks: number;
  open_tasks: number;
}

export interface BrandReportRow {
  brand_id: string;
  brand_name: string;
  // Kategori id'si (`clusters.id`). Etikete çevirmek çağıranın işi —
  // `clusterLabelMap()[cluster] ?? UNKNOWN_CLUSTER_LABEL`.
  cluster: string;
  archived: number;
  total_content: number;
  total_tasks: number;
  completed_tasks: number;
  open_tasks: number;
  overdue_tasks: number;
  on_time_rate: number | null;
  average_cycle_days: number | null;
}

export interface BrandPersonRow {
  brand_id: string;
  person_id: string;
  person_name: string;
  total_tasks: number;
  completed_tasks: number;
  open_tasks: number;
}

export type TrendGranularity = "day" | "week" | "month";

export interface TrendReportPoint {
  key: string;
  label: string;
  opened_tasks: number;
  completed_tasks: number;
}

export interface TrendReport {
  granularity: TrendGranularity;
  points: TrendReportPoint[];
}

export interface CycleTimeBucket {
  key: "one_day" | "two_three" | "four_seven" | "eight_fourteen" | "fifteen_plus";
  label: string;
  task_count: number;
}

export interface CycleTimeReport {
  sample_size: number;
  average_days: number | null;
  median_days: number | null;
  p75_days: number | null;
  buckets: CycleTimeBucket[];
}

export interface DueHealthRow {
  bucket: "overdue" | "today" | "next_seven" | "later" | "unscheduled";
  label: string;
  task_count: number;
}

export interface DeliveryQualityBrandRow {
  brand_id: string;
  brand_name: string;
  total_deliveries: number;
  approved_deliveries: number;
  revision_requests: number;
  approval_rate: number | null;
}

export interface DeliveryRevisionReasonRow {
  reason: string;
  revision_requests: number;
}

export interface DeliveryQualityReport {
  total_deliveries: number;
  pending_deliveries: number;
  approved_deliveries: number;
  revision_requests: number;
  approval_rate: number | null;
  reasons: DeliveryRevisionReasonRow[];
  brands: DeliveryQualityBrandRow[];
}

function periodCondition(column: string, range: DateRange | null): string {
  return range ? `date(${column}) BETWEEN :start AND :end` : "1 = 1";
}

function rangeParams(range: DateRange | null): { start: string; end: string } | undefined {
  return range ? { start: range.start, end: range.end } : undefined;
}

function allForRange<T>(sql: string, range: DateRange | null, scope: ReportScope = null): T[] {
  const statement = getDb().prepare(sql);
  const params = { ...rangeParams(range), ...scopeParams(scope) };
  return plainList<T>(
    Object.keys(params).length > 0 ? statement.all(params) : statement.all(),
  );
}

function parseISODate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

function toISODate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(value: Date, amount: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(value: Date): Date {
  const day = value.getDay();
  return addDays(value, -(day === 0 ? 6 : day - 1));
}

function trendBucketKey(value: Date, granularity: TrendGranularity): string {
  if (granularity === "month") return toISODate(value).slice(0, 7);
  if (granularity === "week") return toISODate(startOfWeek(value));
  return toISODate(value);
}

function trendLabel(key: string, granularity: TrendGranularity): string {
  const date = parseISODate(granularity === "month" ? `${key}-01` : key);
  if (granularity === "month") {
    return new Intl.DateTimeFormat("tr-TR", { month: "short", year: "2-digit" }).format(date);
  }
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" }).format(date);
}

function quantile(sortedValues: number[], percentile: number): number | null {
  if (sortedValues.length === 0) return null;
  const position = (sortedValues.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const value =
    lower === upper
      ? sortedValues[lower]
      : sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (position - lower);
  return Math.round(value * 10) / 10;
}

export function getTrendReport(range: DateRange | null, scope: ReportScope = null): TrendReport {
  const conditions = ["event_date IS NOT NULL"];
  if (range) conditions.push("event_date BETWEEN :start AND :end");
  // Alt sorgudan gelen sütunda tablo takma adı yok.
  const scoped = scopeExpression(scope, "assignee_id");
  if (scoped) conditions.push(scoped);
  const statement = getDb().prepare(`
    SELECT event_date, event_type, COUNT(*) AS task_count
      FROM (
        SELECT date(created_at) AS event_date, 'opened' AS event_type, assignee_id
          FROM tasks
         WHERE ${plannedTaskCondition("tasks")}
        UNION ALL
        SELECT date(completed_at) AS event_date, 'completed' AS event_type, assignee_id
          FROM tasks
         WHERE status = 'Yayinlandi' AND completed_at IS NOT NULL
           AND ${plannedTaskCondition("tasks")}
      ) events
     WHERE ${conditions.join("\n       AND ")}
     GROUP BY event_date, event_type
     ORDER BY event_date
  `);
  const params = { ...rangeParams(range), ...scopeParams(scope) };
  const rows = plainList<{
    event_date: string;
    event_type: "opened" | "completed";
    task_count: number;
  }>(Object.keys(params).length > 0 ? statement.all(params) : statement.all());

  const startValue = range?.start ?? rows[0]?.event_date;
  const endValue = range?.end ?? rows[rows.length - 1]?.event_date;
  if (!startValue || !endValue) return { granularity: "day", points: [] };

  const start = parseISODate(startValue);
  const end = parseISODate(endValue);
  const dayCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  const granularity: TrendGranularity = dayCount <= 35 ? "day" : dayCount <= 210 ? "week" : "month";
  const totals = new Map<string, { opened: number; completed: number }>();

  for (const row of rows) {
    const key = trendBucketKey(parseISODate(row.event_date), granularity);
    const value = totals.get(key) ?? { opened: 0, completed: 0 };
    value[row.event_type] += row.task_count;
    totals.set(key, value);
  }

  const points: TrendReportPoint[] = [];
  let cursor = granularity === "week" ? startOfWeek(start) : start;
  while (cursor <= end) {
    const key = trendBucketKey(cursor, granularity);
    const value = totals.get(key) ?? { opened: 0, completed: 0 };
    points.push({
      key,
      label: trendLabel(key, granularity),
      opened_tasks: value.opened,
      completed_tasks: value.completed,
    });
    if (granularity === "month") {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 12);
    } else {
      cursor = addDays(cursor, granularity === "week" ? 7 : 1);
    }
  }

  return { granularity, points };
}

export function getCycleTimeReport(
  range: DateRange | null,
  scope: ReportScope = null,
): CycleTimeReport {
  const completed = periodCondition("t.completed_at", range);
  const rows = allForRange<{ duration_days: number }>(
    `SELECT MAX(julianday(t.completed_at) - julianday(t.created_at), 0) AS duration_days
       FROM tasks t
      WHERE ${IS_PLANNED}
        AND t.status = 'Yayinlandi'
        AND t.completed_at IS NOT NULL
        AND ${completed}
        ${scopeCondition(scope)}
      ORDER BY duration_days`,
    range,
    scope,
  );
  const durations = rows.map((row) => row.duration_days).sort((a, b) => a - b);
  const bucketDefinitions: Array<{
    key: CycleTimeBucket["key"];
    label: string;
    matches: (value: number) => boolean;
  }> = [
    { key: "one_day", label: "0–1 gün", matches: (value) => value <= 1 },
    { key: "two_three", label: "2–3 gün", matches: (value) => value > 1 && value <= 3 },
    { key: "four_seven", label: "4–7 gün", matches: (value) => value > 3 && value <= 7 },
    { key: "eight_fourteen", label: "8–14 gün", matches: (value) => value > 7 && value <= 14 },
    { key: "fifteen_plus", label: "15+ gün", matches: (value) => value > 14 },
  ];

  return {
    sample_size: durations.length,
    average_days:
      durations.length === 0
        ? null
        : Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length) * 10) / 10,
    median_days: quantile(durations, 0.5),
    p75_days: quantile(durations, 0.75),
    buckets: bucketDefinitions.map(({ key, label, matches }) => ({
      key,
      label,
      task_count: durations.filter(matches).length,
    })),
  };
}

export function listDueHealthReport(
  today: string,
  scope: ReportScope = null,
): DueHealthRow[] {
  return plainList<DueHealthRow>(
    getDb()
      .prepare(
        `WITH buckets(bucket, label, sort_order) AS (
           VALUES ('overdue', 'Gecikmiş', 1),
                  ('today', 'Bugün', 2),
                  ('next_seven', 'Önümüzdeki 7 gün', 3),
                  ('later', 'Daha sonra', 4),
                  ('unscheduled', 'Tarihsiz', 5)
         )
         SELECT buckets.bucket, buckets.label, COUNT(t.id) AS task_count
           FROM buckets
           LEFT JOIN tasks t
             ON t.status != 'Yayinlandi'
            AND ${IS_PLANNED}
            ${scopeCondition(scope)}
            AND CASE buckets.bucket
              WHEN 'overdue' THEN t.due_date IS NOT NULL AND t.due_date < :today
              WHEN 'today' THEN t.due_date = :today
              WHEN 'next_seven' THEN t.due_date > :today AND t.due_date <= date(:today, '+7 day')
              WHEN 'later' THEN t.due_date > date(:today, '+7 day')
              WHEN 'unscheduled' THEN t.due_date IS NULL
            END
          GROUP BY buckets.bucket, buckets.label, buckets.sort_order
          ORDER BY buckets.sort_order`,
      )
      .all({ today, ...scopeParams(scope) }),
  );
}

export function getDeliveryQualityReport(range: DateRange | null): DeliveryQualityReport {
  const submitted = periodCondition("d.submitted_at", range);
  const params = rangeParams(range);
  const summaryStatement = getDb().prepare(
    `SELECT COUNT(*) AS total_deliveries,
            COALESCE(SUM(CASE WHEN d.status = 'Beklemede' THEN 1 ELSE 0 END), 0) AS pending_deliveries,
            COALESCE(SUM(CASE WHEN d.status = 'Onaylandi' THEN 1 ELSE 0 END), 0) AS approved_deliveries,
            COALESCE(SUM(CASE WHEN d.status = 'RevizeIstendi' THEN 1 ELSE 0 END), 0) AS revision_requests,
            ROUND(
              100.0 * SUM(CASE WHEN d.status = 'Onaylandi' THEN 1 ELSE 0 END)
              / NULLIF(SUM(CASE WHEN d.status IN ('Onaylandi', 'RevizeIstendi') THEN 1 ELSE 0 END), 0),
              1
            ) AS approval_rate
       FROM task_deliveries d
      WHERE ${submitted}`,
  );
  const summary = plainOne<Omit<DeliveryQualityReport, "reasons" | "brands">>(
    params ? summaryStatement.get(params) : summaryStatement.get(),
  ) ?? {
    total_deliveries: 0,
    pending_deliveries: 0,
    approved_deliveries: 0,
    revision_requests: 0,
    approval_rate: null,
  };

  const reasons = allForRange<DeliveryRevisionReasonRow>(
    `SELECT d.revision_reason AS reason, COUNT(*) AS revision_requests
       FROM task_deliveries d
      WHERE d.status = 'RevizeIstendi' AND d.revision_reason IS NOT NULL
        AND ${submitted}
      GROUP BY d.revision_reason
      ORDER BY revision_requests DESC, d.revision_reason`,
    range,
  );
  const brands = allForRange<DeliveryQualityBrandRow>(
    `SELECT b.id AS brand_id, b.name AS brand_name,
            COUNT(*) AS total_deliveries,
            COALESCE(SUM(CASE WHEN d.status = 'Onaylandi' THEN 1 ELSE 0 END), 0) AS approved_deliveries,
            COALESCE(SUM(CASE WHEN d.status = 'RevizeIstendi' THEN 1 ELSE 0 END), 0) AS revision_requests,
            ROUND(
              100.0 * SUM(CASE WHEN d.status = 'Onaylandi' THEN 1 ELSE 0 END)
              / NULLIF(SUM(CASE WHEN d.status IN ('Onaylandi', 'RevizeIstendi') THEN 1 ELSE 0 END), 0),
              1
            ) AS approval_rate
       FROM task_deliveries d
       JOIN tasks t ON t.id = d.task_id
       JOIN content_items ci ON ci.id = t.content_item_id
       JOIN brands b ON b.id = ci.brand_id
      WHERE ${submitted}
      GROUP BY b.id, b.name
      ORDER BY revision_requests DESC, total_deliveries DESC, b.name`,
    range,
  );

  return { ...summary, reasons, brands };
}

export function getReportSummary(
  range: DateRange | null,
  today: string,
  scope: ReportScope = null,
): ReportSummary {
  const opened = periodCondition("t.created_at", range);
  const completed = periodCondition("t.completed_at", range);
  const scoped = scopeExpression(scope);
  const statement = getDb().prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN ${opened} THEN 1 ELSE 0 END), 0) AS opened_tasks,
      COALESCE(SUM(CASE
        WHEN t.status = 'Yayinlandi' AND ${completed} THEN 1 ELSE 0 END), 0
      ) AS completed_tasks,
      COALESCE(SUM(CASE WHEN t.status != 'Yayinlandi' THEN 1 ELSE 0 END), 0)
        AS open_tasks,
      COALESCE(SUM(CASE
        WHEN t.status != 'Yayinlandi'
         AND t.due_date IS NOT NULL
         AND t.due_date < :today
        THEN 1 ELSE 0 END), 0) AS overdue_tasks,
      ROUND(
        100.0 * SUM(CASE
          WHEN t.status = 'Yayinlandi'
           AND ${completed}
           AND t.due_date IS NOT NULL
           AND date(t.completed_at) <= t.due_date
          THEN 1 ELSE 0 END)
        / NULLIF(SUM(CASE
          WHEN t.status = 'Yayinlandi'
           AND ${completed}
           AND t.due_date IS NOT NULL
          THEN 1 ELSE 0 END), 0),
        0
      ) AS on_time_rate,
      ROUND(AVG(CASE
        WHEN t.status = 'Yayinlandi' AND ${completed}
        THEN MAX(julianday(t.completed_at) - julianday(t.created_at), 0)
      END), 1) AS average_cycle_days
    FROM tasks t
    WHERE ${IS_PLANNED}${scoped ? ` AND ${scoped}` : ""}
  `);
  const params: Record<string, string> = { today, ...scopeParams(scope) };
  if (range) {
    params.start = range.start;
    params.end = range.end;
  }
  return (
    plainOne<ReportSummary>(statement.get(params)) ?? {
      opened_tasks: 0,
      completed_tasks: 0,
      open_tasks: 0,
      overdue_tasks: 0,
      on_time_rate: null,
      average_cycle_days: null,
    }
  );
}

export function listWorkflowReport(scope: ReportScope = null): WorkflowReportRow[] {
  return plainList<WorkflowReportRow>(
    getDb()
      .prepare(
        `WITH workflow(status, sort_order) AS (
           VALUES ('Beklemede', 1), ('DevamEdiyor', 2),
                  ('Incelemede', 3), ('Onaylandi', 4)
         )
         SELECT workflow.status, COUNT(t.id) AS task_count
           FROM workflow
           LEFT JOIN tasks t ON t.status = workflow.status
            AND ${IS_PLANNED} ${scopeCondition(scope)}
          GROUP BY workflow.status, workflow.sort_order
          ORDER BY workflow.sort_order`,
      )
      .all({ ...scopeParams(scope) }),
  );
}

export interface PriorityReportRow {
  priority: TaskPriority;
  open_tasks: number;
  overdue_tasks: number;
}

// Kişinin açık işlerinin öncelik dağılımı — "yoğun mu" sorusunun yanında
// "yoğunluğu ne kadarı acil" sorusunu cevaplar. Boş öncelikler de 0 ile döner
// ki grafik her kişide aynı 4 satırı göstersin.
export function listPriorityReport(
  today: string,
  scope: ReportScope = null,
): PriorityReportRow[] {
  return plainList<PriorityReportRow>(
    getDb()
      .prepare(
        `WITH levels(priority, sort_order) AS (
           VALUES ('Acil', 0), ('Yuksek', 1), ('Normal', 2), ('Dusuk', 3)
         )
         SELECT levels.priority,
                COUNT(t.id) AS open_tasks,
                COALESCE(SUM(CASE
                  WHEN t.due_date IS NOT NULL AND t.due_date < :today
                  THEN 1 ELSE 0 END), 0) AS overdue_tasks
           FROM levels
           LEFT JOIN tasks t
             ON t.priority = levels.priority
            AND t.status != 'Yayinlandi'
            AND ${IS_PLANNED}
            ${scopeCondition(scope)}
          GROUP BY levels.priority, levels.sort_order
          ORDER BY levels.sort_order`,
      )
      .all({ today, ...scopeParams(scope) }),
  );
}

export function listPersonReport(
  range: DateRange | null,
  today: string,
): PersonReportRow[] {
  const opened = periodCondition("t.created_at", range);
  const completed = periodCondition("t.completed_at", range);
  const statement = getDb().prepare(`
    SELECT p.id AS person_id, p.name AS person_name,
      p.department AS department, p.avatar_path AS avatar_path, p.active,
      -- "t.id IS NOT NULL": LEFT JOIN, görevi olmayan kişi için de bir satır
      -- üretiyor; aralık verilmediğinde dönem koşulu sabit "1 = 1" olduğu için
      -- o boş satır 1 açılan iş gibi sayılırdı.
      COALESCE(SUM(CASE WHEN t.id IS NOT NULL AND ${opened} THEN 1 ELSE 0 END), 0)
        AS total_tasks,
      COALESCE(SUM(CASE
        WHEN t.status = 'Yayinlandi' AND ${completed} THEN 1 ELSE 0 END), 0
      ) AS completed_tasks,
      COALESCE(SUM(CASE WHEN t.status != 'Yayinlandi' THEN 1 ELSE 0 END), 0)
        AS open_tasks,
      COALESCE(SUM(CASE
        WHEN t.status != 'Yayinlandi'
         AND t.due_date IS NOT NULL
         AND t.due_date < :today
        THEN 1 ELSE 0 END), 0) AS overdue_tasks,
      ROUND(
        100.0 * SUM(CASE
          WHEN t.status = 'Yayinlandi'
           AND ${completed}
           AND t.due_date IS NOT NULL
           AND date(t.completed_at) <= t.due_date
          THEN 1 ELSE 0 END)
        / NULLIF(SUM(CASE
          WHEN t.status = 'Yayinlandi'
           AND ${completed}
           AND t.due_date IS NOT NULL
          THEN 1 ELSE 0 END), 0),
        0
      ) AS on_time_rate,
      ROUND(AVG(CASE
        WHEN t.status = 'Yayinlandi' AND ${completed}
        THEN MAX(julianday(t.completed_at) - julianday(t.created_at), 0)
      END), 1) AS average_cycle_days
    FROM people p
    LEFT JOIN tasks t ON t.assignee_id = p.id AND ${IS_PLANNED}
    GROUP BY p.id
    ORDER BY completed_tasks DESC, open_tasks DESC, p.name
  `);
  const params: Record<string, string> = { today };
  if (range) {
    params.start = range.start;
    params.end = range.end;
  }
  return plainList<PersonReportRow>(statement.all(params));
}

export interface DepartmentReportRow {
  department: DepartmentKey;
  person_count: number;
  active_person_count: number;
  total_tasks: number;
  completed_tasks: number;
  open_tasks: number;
  overdue_tasks: number;
  on_time_rate: number | null;
  average_cycle_days: number | null;
}

/**
 * Departman satırları KİŞİLER üzerinden toplanır (görevde departman sütunu
 * yok): departmandaki herkesin işi tek satırda birleşir, atanmamış işler
 * hiçbir satıra girmez.
 *
 * Neden ayrı bir sorgu — kişi satırlarından toplanamaz mı? Sayılar toplanabilir
 * ama "zamanında tamamlama" ve "ortalama süre" toplanamaz: oranların/
 * ortalamaların ortalaması, iş sayısı farklı kişilerde yanlış sonuç verir.
 * Departmanı olmayan/tanınmayan kişiler `NO_DEPARTMENT` kovasında toplanır.
 */
export function listDepartmentReport(
  range: DateRange | null,
  today: string,
): DepartmentReportRow[] {
  const opened = periodCondition("t.created_at", range);
  const completed = periodCondition("t.completed_at", range);
  // GROUP BY/ORDER BY'da TAKMA AD DEĞİL ifadenin kendisi kullanılmalı: SQLite
  // `department` adını önce kaynak sütuna (`p.department`) bağlar, çıktı takma
  // adına değil — takma adla gruplanınca NULL ve tanınmayan değer ayrı satır
  // kalıyor, "Diğer" ikiye bölünüyordu.
  const bucket = departmentBucketExpression("p.department");
  const statement = getDb().prepare(`
    SELECT ${bucket} AS department,
      COUNT(DISTINCT p.id) AS person_count,
      COUNT(DISTINCT CASE WHEN p.active = 1 THEN p.id END) AS active_person_count,
      -- "t.id IS NOT NULL": bkz. listPersonReport.
      COALESCE(SUM(CASE WHEN t.id IS NOT NULL AND ${opened} THEN 1 ELSE 0 END), 0)
        AS total_tasks,
      COALESCE(SUM(CASE
        WHEN t.status = 'Yayinlandi' AND ${completed} THEN 1 ELSE 0 END), 0
      ) AS completed_tasks,
      COALESCE(SUM(CASE WHEN t.status != 'Yayinlandi' THEN 1 ELSE 0 END), 0)
        AS open_tasks,
      COALESCE(SUM(CASE
        WHEN t.status != 'Yayinlandi'
         AND t.due_date IS NOT NULL
         AND t.due_date < :today
        THEN 1 ELSE 0 END), 0) AS overdue_tasks,
      ROUND(
        100.0 * SUM(CASE
          WHEN t.status = 'Yayinlandi'
           AND ${completed}
           AND t.due_date IS NOT NULL
           AND date(t.completed_at) <= t.due_date
          THEN 1 ELSE 0 END)
        / NULLIF(SUM(CASE
          WHEN t.status = 'Yayinlandi'
           AND ${completed}
           AND t.due_date IS NOT NULL
          THEN 1 ELSE 0 END), 0),
        0
      ) AS on_time_rate,
      ROUND(AVG(CASE
        WHEN t.status = 'Yayinlandi' AND ${completed}
        THEN MAX(julianday(t.completed_at) - julianday(t.created_at), 0)
      END), 1) AS average_cycle_days
    FROM people p
    LEFT JOIN tasks t ON t.assignee_id = p.id AND ${IS_PLANNED}
    GROUP BY ${bucket}
    ORDER BY completed_tasks DESC, open_tasks DESC, ${bucket}
  `);
  const params: Record<string, string> = { today };
  if (range) {
    params.start = range.start;
    params.end = range.end;
  }
  return plainList<DepartmentReportRow>(statement.all(params));
}

export interface BrandBreakdownRow {
  brand_id: string;
  brand_name: string;
  total_tasks: number;
  completed_tasks: number;
  open_tasks: number;
}

// Kapsamın (kişi ya da departman) hangi markalara çalıştığı. Kişi raporundaki
// `listPersonBrandBreakdown`'dan farkı: kişi kırılımı yok, satırlar doğrudan
// marka bazında toplanıyor — departmanda birden çok kişi var.
export function listBrandBreakdownForScope(
  range: DateRange | null,
  scope: ReportScope = null,
): BrandBreakdownRow[] {
  const opened = periodCondition("t.created_at", range);
  const completed = periodCondition("t.completed_at", range);
  return allForRange<BrandBreakdownRow>(
    `SELECT b.id AS brand_id, b.name AS brand_name,
            SUM(CASE WHEN ${opened} THEN 1 ELSE 0 END) AS total_tasks,
            SUM(CASE
              WHEN t.status = 'Yayinlandi' AND ${completed} THEN 1 ELSE 0 END
            ) AS completed_tasks,
            SUM(CASE WHEN t.status != 'Yayinlandi' THEN 1 ELSE 0 END) AS open_tasks
       FROM tasks t
       JOIN content_items ci ON ci.id = t.content_item_id
       JOIN brands b ON b.id = ci.brand_id
      WHERE ${IS_PLANNED} ${scopeCondition(scope)}
      GROUP BY b.id
     HAVING total_tasks > 0 OR completed_tasks > 0 OR open_tasks > 0
      ORDER BY completed_tasks DESC, open_tasks DESC, b.name`,
    range,
    scope,
  );
}

export function listPersonBrandBreakdown(
  range: DateRange | null,
  scope: ReportScope = null,
): PersonBrandRow[] {
  const opened = periodCondition("t.created_at", range);
  const completed = periodCondition("t.completed_at", range);
  return allForRange<PersonBrandRow>(
    `SELECT p.id AS person_id, b.id AS brand_id, b.name AS brand_name,
            SUM(CASE WHEN ${opened} THEN 1 ELSE 0 END) AS total_tasks,
            SUM(CASE
              WHEN t.status = 'Yayinlandi' AND ${completed} THEN 1 ELSE 0 END
            ) AS completed_tasks,
            SUM(CASE WHEN t.status != 'Yayinlandi' THEN 1 ELSE 0 END) AS open_tasks
       FROM tasks t
       JOIN content_items ci ON ci.id = t.content_item_id
       JOIN brands b ON b.id = ci.brand_id
       JOIN people p ON p.id = t.assignee_id
      WHERE ${IS_PLANNED} ${scopeCondition(scope)}
      GROUP BY p.id, b.id
     HAVING total_tasks > 0 OR completed_tasks > 0 OR open_tasks > 0
      ORDER BY p.name, completed_tasks DESC, open_tasks DESC`,
    range,
    scope,
  );
}

// Arşivlenmiş markalar geçmiş raporlarında kalır; kullanıcı isterse arayüzden
// gizleyebilir. "İçerik" sayısı seçili dönemde açılan içerikleri ifade eder.
export function listBrandReport(
  range: DateRange | null,
  today: string,
): BrandReportRow[] {
  const contentOpened = periodCondition("ci.created_at", range);
  const taskOpened = periodCondition("t.created_at", range);
  const completed = periodCondition("t.completed_at", range);
  const statement = getDb().prepare(`
    SELECT b.id AS brand_id, b.name AS brand_name, b.cluster AS cluster,
      b.archived AS archived,
      COUNT(DISTINCT CASE WHEN ${contentOpened} THEN ci.id END) AS total_content,
      -- "t.id IS NOT NULL": bkz. listPersonReport — görevi olmayan markanın
      -- LEFT JOIN'den gelen boş satırı "1 açılan iş" gibi sayılmasın.
      COALESCE(SUM(CASE WHEN t.id IS NOT NULL AND ${taskOpened} THEN 1 ELSE 0 END), 0)
        AS total_tasks,
      COALESCE(SUM(CASE
        WHEN t.status = 'Yayinlandi' AND ${completed} THEN 1 ELSE 0 END), 0
      ) AS completed_tasks,
      COALESCE(SUM(CASE WHEN t.status != 'Yayinlandi' THEN 1 ELSE 0 END), 0)
        AS open_tasks,
      COALESCE(SUM(CASE
        WHEN t.status != 'Yayinlandi'
         AND t.due_date IS NOT NULL
         AND t.due_date < :today
        THEN 1 ELSE 0 END), 0) AS overdue_tasks,
      ROUND(
        100.0 * SUM(CASE
          WHEN t.status = 'Yayinlandi'
           AND ${completed}
           AND t.due_date IS NOT NULL
           AND date(t.completed_at) <= t.due_date
          THEN 1 ELSE 0 END)
        / NULLIF(SUM(CASE
          WHEN t.status = 'Yayinlandi'
           AND ${completed}
           AND t.due_date IS NOT NULL
          THEN 1 ELSE 0 END), 0),
        0
      ) AS on_time_rate,
      ROUND(AVG(CASE
        WHEN t.status = 'Yayinlandi' AND ${completed}
        THEN MAX(julianday(t.completed_at) - julianday(t.created_at), 0)
      END), 1) AS average_cycle_days
    FROM brands b
    LEFT JOIN content_items ci ON ci.brand_id = b.id AND ${visibleContentCondition("ci")}
    LEFT JOIN tasks t ON t.content_item_id = ci.id AND ${IS_PLANNED}
    GROUP BY b.id
    ORDER BY completed_tasks DESC, open_tasks DESC, b.name
  `);
  const params: Record<string, string> = { today };
  if (range) {
    params.start = range.start;
    params.end = range.end;
  }
  return plainList<BrandReportRow>(statement.all(params));
}

// Excel dökümündeki satır satır görev listesi. Rapor ekranları yalnızca SAYI
// gösteriyor ("12 tamamlandı"); dışa aktarma o sayıların arkasındaki işleri de
// taşımalı — hangi görev, hangi marka, hangi kategori, kim, ne zaman.
export interface TaskDetailRow {
  task_id: string;
  title: string;
  brand_name: string;
  cluster: string;
  content_title: string;
  content_type: string;
  assignee_name: string | null;
  department: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
  archived_at: string | null;
  cycle_days: number | null;
  overdue: number;
  opened_in_period: number;
  completed_in_period: number;
  comment_count: number;
}

/**
 * Seçili dönemle ilgili TÜM görevler: dönemde açılanlar, dönemde tamamlananlar
 * ve hâlâ açık olanlar. Üçünün birleşimi, çünkü ekrandaki özet de bu üç sayıyı
 * yan yana gösteriyor — döküm ile kartlar aynı evreni anlatsın.
 *
 * `opened_in_period` / `completed_in_period` sütunları hangi satırın hangi
 * sayıya katkı verdiğini gösterir; böylece Excel'de filtreleyip özet sayfasıyla
 * karşılaştırmak mümkün olur. Aralık verilmezse (Tüm zamanlar) her satır
 * "dönemde" sayılır.
 */
export function listTaskDetailReport(
  range: DateRange | null,
  today: string,
  scope: ReportScope = null,
): TaskDetailRow[] {
  const opened = periodCondition("t.created_at", range);
  const completed = periodCondition("t.completed_at", range);
  const statement = getDb().prepare(
    `SELECT t.id AS task_id, t.title AS title,
            b.name AS brand_name, b.cluster AS cluster,
            ci.title AS content_title, COALESCE(t.type_override, ci.type) AS content_type,
            p.name AS assignee_name, p.department AS department,
            t.status, t.priority, t.due_date, t.created_at, t.completed_at,
            t.archived_at,
            CASE WHEN t.status = 'Yayinlandi' AND t.completed_at IS NOT NULL
              THEN ROUND(MAX(julianday(t.completed_at) - julianday(t.created_at), 0), 1)
            END AS cycle_days,
            CASE WHEN t.status != 'Yayinlandi'
                  AND t.due_date IS NOT NULL AND t.due_date < :today
              THEN 1 ELSE 0 END AS overdue,
            CASE WHEN ${opened} THEN 1 ELSE 0 END AS opened_in_period,
            CASE WHEN t.status = 'Yayinlandi' AND ${completed}
              THEN 1 ELSE 0 END AS completed_in_period,
            (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) AS comment_count
       FROM tasks t
       JOIN content_items ci ON ci.id = t.content_item_id
       JOIN brands b ON b.id = ci.brand_id
       LEFT JOIN people p ON p.id = t.assignee_id
      WHERE ${IS_PLANNED}
        AND (${opened}
             OR (t.status = 'Yayinlandi' AND t.completed_at IS NOT NULL AND ${completed})
             OR t.status != 'Yayinlandi')
        ${scopeCondition(scope)}
      ORDER BY b.name, ci.title,
               CASE t.priority
                 WHEN 'Acil' THEN 0 WHEN 'Yuksek' THEN 1 WHEN 'Normal' THEN 2 ELSE 3 END,
               (t.due_date IS NULL), t.due_date, t.title`,
  );
  return plainList<TaskDetailRow>(
    statement.all({ today, ...rangeParams(range), ...scopeParams(scope) }),
  );
}

export function listBrandPersonBreakdown(
  range: DateRange | null,
): BrandPersonRow[] {
  const opened = periodCondition("t.created_at", range);
  const completed = periodCondition("t.completed_at", range);
  return allForRange<BrandPersonRow>(
    `SELECT b.id AS brand_id, p.id AS person_id, p.name AS person_name,
            SUM(CASE WHEN ${opened} THEN 1 ELSE 0 END) AS total_tasks,
            SUM(CASE
              WHEN t.status = 'Yayinlandi' AND ${completed} THEN 1 ELSE 0 END
            ) AS completed_tasks,
            SUM(CASE WHEN t.status != 'Yayinlandi' THEN 1 ELSE 0 END) AS open_tasks
       FROM tasks t
       JOIN content_items ci ON ci.id = t.content_item_id
       JOIN brands b ON b.id = ci.brand_id
       JOIN people p ON p.id = t.assignee_id
      WHERE ${IS_PLANNED}
      GROUP BY b.id, p.id
     HAVING total_tasks > 0 OR completed_tasks > 0 OR open_tasks > 0
      ORDER BY b.name, completed_tasks DESC, open_tasks DESC`,
    range,
  );
}
