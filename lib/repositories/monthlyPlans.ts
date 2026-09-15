import { getDb, plainList, plainOne } from "@/lib/db/client";
import { catalogItem, packageUnitsFor, type PointProfile } from "@/lib/points/catalog";
import { istanbulDay } from "@/lib/points/period";
import { packageScopeKey } from "@/lib/repositories/pointPackages";
import { currentCatalogVersion } from "@/lib/repositories/pointCatalog";
import {
  DEFAULT_GENERATION_DAY,
  renderTitlePattern,
  shouldGenerateOn,
  suggestedDueDates,
} from "@/lib/monthlyPlan";
import type { ContentType } from "@/lib/types";

export interface MonthlyTaskPlanRow {
  id: string;
  label: string;
  brand_id: string | null;
  profile: PointProfile;
  item_key: string;
  assignee_id: string | null;
  content_type: ContentType;
  item_count: number;
  title_pattern: string;
  start_month: string;
  generation_day: number;
  paused: number;
  created_at: string;
  updated_at: string;
}

export interface MonthlyTaskPlanView extends MonthlyTaskPlanRow {
  brand_name: string | null;
  assignee_name: string | null;
  last_run_at: string | null;
  last_run_month: string | null;
  last_run_status: string | null;
  last_run_error: string | null;
}

const PLAN_SELECT = `
  SELECT p.*, b.name AS brand_name, pe.name AS assignee_name,
         r.created_at AS last_run_at, r.plan_month AS last_run_month,
         r.status AS last_run_status, r.error AS last_run_error
    FROM monthly_task_plans p
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN people pe ON pe.id = p.assignee_id
    LEFT JOIN monthly_task_plan_runs r
      ON r.id = (SELECT id FROM monthly_task_plan_runs rr
                  WHERE rr.plan_id = p.id ORDER BY rr.created_at DESC, rr.id LIMIT 1)
`;

export function listMonthlyTaskPlans(): MonthlyTaskPlanView[] {
  return plainList<MonthlyTaskPlanView>(
    getDb().prepare(`${PLAN_SELECT} ORDER BY p.paused, b.name, p.label`).all(),
  );
}

export function getMonthlyTaskPlan(id: string): MonthlyTaskPlanView | undefined {
  return plainOne<MonthlyTaskPlanView>(getDb().prepare(`${PLAN_SELECT} WHERE p.id = ?`).get(id));
}

export interface PlanRunRow {
  id: string;
  plan_id: string;
  plan_month: string;
  status: "ok" | "error" | "skipped";
  package_id: string | null;
  task_count: number;
  error: string | null;
  source: "auto" | "manual";
  created_at: string;
}

export function listPlanRuns(planId: string, limit = 12): PlanRunRow[] {
  return plainList<PlanRunRow>(
    getDb()
      .prepare(
        `SELECT * FROM monthly_task_plan_runs WHERE plan_id = ?
          ORDER BY created_at DESC, id LIMIT ?`,
      )
      .all(planId, limit),
  );
}

export interface PreviewRow {
  title: string;
  dueDate: string;
  contentType: ContentType;
  assigneeId: string | null;
}

/**
 * Kaydetmeden ÖNCE gösterilen satırlar. Tarihler yalnızca ÖNERİDİR; kullanıcı
 * önizlemede her satırı ayrı ayrı değiştirebilir.
 */
export function previewMonthlyRows(input: {
  month: string;
  count: number;
  titlePattern: string;
  brandName: string;
  contentType: ContentType;
  assigneeId: string | null;
}): PreviewRow[] {
  const dates = suggestedDueDates(input.month, input.count);
  return dates.map((dueDate, index) => ({
    title: renderTitlePattern(input.titlePattern, {
      index: index + 1,
      month: input.month,
      brandName: input.brandName,
    }),
    dueDate,
    contentType: input.contentType,
    assigneeId: input.assigneeId,
  }));
}

export interface BulkCreateResult {
  packageId: string;
  taskIds: string[];
}

/**
 * Dört görev = DÖRT BAĞIMSIZ İÇERİK. Tek işin dört aşaması değil: her biri
 * kendi içerik kaydına, teslim sürümüne ve onayına sahip. Aylık takip için
 * hepsi TEK bir puan paketinde gruplanır — paketin bütün üyeleri onaylanmadan
 * puan doğmaz.
 *
 * Tamamı TEK transaction: yarım paket kalmaz, çift gönderim yeni kopya üretmez
 * (paketin scope_key'i UNIQUE).
 */
export function createMonthlyPackage(input: {
  brandId: string;
  profile: PointProfile;
  itemKey: string;
  planMonth: string;
  personId: string;
  rows: PreviewRow[];
  createdBy: string;
  planId?: string | null;
  source?: "auto" | "manual";
}): BulkCreateResult {
  const item = catalogItem(input.profile, input.itemKey);
  if (!item) throw new Error("Bu profilde böyle bir katalog kalemi yok.");
  if (input.rows.length < item.requiredCount) {
    throw new Error(`Bu kalem için ${item.requiredCount} iş gerekiyor; ${input.rows.length} satır var.`);
  }
  const version = currentCatalogVersion();
  if (!version) throw new Error("Puan kataloğu bulunamadı.");

  const db = getDb();
  const packageId = crypto.randomUUID();
  const scopeKey = packageScopeKey({
    profile: input.profile,
    scope: item.scope,
    brandId: item.scope === "brand" ? input.brandId : null,
    personId: input.personId,
    planMonth: input.planMonth,
    itemKey: input.itemKey,
  });

  db.exec("BEGIN IMMEDIATE");
  try {
    const brand = db
      .prepare("SELECT id, name, archived, customer_approval_default FROM brands WHERE id = ?")
      .get(input.brandId) as { id: string; name: string; archived: number; customer_approval_default: number } | undefined;
    if (!brand) throw new Error("Marka bulunamadı.");
    if (brand.archived === 1) throw new Error("Arşivlenmiş marka için paket üretilemez.");
    const person = db
      .prepare("SELECT id, active FROM people WHERE id = ?")
      .get(input.personId) as { id: string; active: number } | undefined;
    if (!person) throw new Error("Hak sahibi bulunamadı.");
    if (person.active !== 1) throw new Error("Pasif kişi için paket üretilemez.");
    if (db.prepare("SELECT 1 FROM point_packages WHERE scope_key = ?").get(scopeKey)) {
      throw new Error("Bu kapsam için bu ay zaten bir paket üretilmiş.");
    }

    const insertContent = db.prepare(
      `INSERT INTO content_items (id, brand_id, title, type, target_date, assignee_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const insertTask = db.prepare(
      `INSERT INTO tasks
         (id, content_item_id, title, type_override, assignee_id, due_date,
          difficulty, priority, weight_points, customer_approval_required)
       VALUES (?, ?, ?, ?, ?, ?, 'Orta', 'Normal', 1, ?)`,
    );
    const taskIds: string[] = [];
    for (const row of input.rows) {
      const contentId = crypto.randomUUID();
      const taskId = crypto.randomUUID();
      insertContent.run(contentId, input.brandId, row.title, row.contentType, row.dueDate, row.assigneeId);
      insertTask.run(
        taskId, contentId, row.title, row.contentType, row.assigneeId, row.dueDate,
        brand.customer_approval_default,
      );
      taskIds.push(taskId);
    }

    db.prepare(
      `INSERT INTO point_packages
         (id, scope_key, profile, scope, brand_id, person_id, plan_month, item_key,
          catalog_version_id, required_count, amount_units, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      packageId, scopeKey, input.profile, item.scope,
      item.scope === "brand" ? input.brandId : null,
      input.personId, input.planMonth, input.itemKey, version.id,
      item.requiredCount, packageUnitsFor(item), input.createdBy,
    );
    const insertMember = db.prepare(
      "INSERT INTO point_package_members (package_id, task_id) VALUES (?, ?)",
    );
    for (const taskId of taskIds) insertMember.run(packageId, taskId);

    if (input.planId) {
      // Aynı ay için daha önce bir HATA kaydı yazılmış olabilir (kesinti,
      // pasif sorumlu…). Başarılı üretim o satırı günceller; UNIQUE kısıtı
      // yüzünden ikinci INSERT patlamasın ve düzeltilen plan çalışabilsin.
      db.prepare(
        `INSERT INTO monthly_task_plan_runs (id, plan_id, plan_month, status, package_id, task_count, source)
         VALUES (?, ?, ?, 'ok', ?, ?, ?)
         ON CONFLICT(plan_id, plan_month) DO UPDATE SET
           status = 'ok', package_id = excluded.package_id, task_count = excluded.task_count,
           error = NULL, source = excluded.source, created_at = datetime('now')`,
      ).run(crypto.randomUUID(), input.planId, input.planMonth, packageId, taskIds.length, input.source ?? "manual");
    }

    db.exec("COMMIT");
    return { packageId, taskIds };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function recordPlanFailure(planId: string, planMonth: string, message: string): void {
  // Aynı ayın kaydı varsa SON hatayı gösterir; başarıyla kapanmış bir ayı
  // (status='ok') geri hataya düşürmez.
  getDb()
    .prepare(
      `INSERT INTO monthly_task_plan_runs
         (id, plan_id, plan_month, status, error, source)
       VALUES (?, ?, ?, 'error', ?, 'auto')
       ON CONFLICT(plan_id, plan_month) DO UPDATE SET
         status = CASE WHEN monthly_task_plan_runs.status = 'ok' THEN 'ok' ELSE 'error' END,
         error = CASE WHEN monthly_task_plan_runs.status = 'ok' THEN monthly_task_plan_runs.error ELSE excluded.error END,
         created_at = datetime('now')`,
    )
    .run(crypto.randomUUID(), planId, planMonth, message);
}

export interface PlanRunOutcome {
  planId: string;
  planMonth: string;
  status: "ok" | "error" | "skipped";
  message?: string;
  packageId?: string;
}

/**
 * Otomasyonun tek turu. GEÇMİŞ AYLARA sessizce görev yığmaz: yalnızca
 * çalıştırılan ayın paketi açılır, kesinti sonrası aynı ayın eksiği
 * tamamlanabilir. Plan/ay kimliği benzersiz olduğu için tekrar çalıştırmak
 * ikinci paket üretmez.
 */
export function runMonthlyPlans(input: {
  today?: string;
  actorId: string;
}): PlanRunOutcome[] {
  const today = input.today ?? istanbulDay(new Date().toISOString());
  const planMonth = today.slice(0, 7);
  const day = Number(today.slice(8, 10));
  const outcomes: PlanRunOutcome[] = [];

  for (const plan of listMonthlyTaskPlans()) {
    if (plan.paused === 1) continue;
    if (plan.start_month > planMonth) continue;
    if (!shouldGenerateOn(day, plan.generation_day || DEFAULT_GENERATION_DAY)) continue;
    const already = getDb()
      .prepare("SELECT status FROM monthly_task_plan_runs WHERE plan_id = ? AND plan_month = ?")
      .get(plan.id, planMonth) as { status: string } | undefined;
    if (already?.status === "ok") continue;
    if (!plan.brand_id || !plan.assignee_id) {
      const message = "Plan eksik: marka ya da sorumlu tanımlı değil.";
      recordPlanFailure(plan.id, planMonth, message);
      outcomes.push({ planId: plan.id, planMonth, status: "error", message });
      continue;
    }
    try {
      const rows = previewMonthlyRows({
        month: planMonth,
        count: plan.item_count,
        titlePattern: plan.title_pattern,
        brandName: plan.brand_name ?? "",
        contentType: plan.content_type,
        assigneeId: plan.assignee_id,
      });
      const result = createMonthlyPackage({
        brandId: plan.brand_id,
        profile: plan.profile,
        itemKey: plan.item_key,
        planMonth,
        personId: plan.assignee_id,
        rows,
        createdBy: input.actorId,
        planId: plan.id,
        source: "auto",
      });
      outcomes.push({ planId: plan.id, planMonth, status: "ok", packageId: result.packageId });
    } catch (error) {
      // Pasif kişi / arşivli marka gibi nedenler yöneticiye GÖSTERİLİR;
      // sessizce atlanmaz.
      const message = error instanceof Error ? error.message : "Bilinmeyen hata";
      recordPlanFailure(plan.id, planMonth, message);
      outcomes.push({ planId: plan.id, planMonth, status: "error", message });
    }
  }
  return outcomes;
}

export function upsertMonthlyTaskPlan(input: {
  id?: string;
  label: string;
  brandId: string;
  profile: PointProfile;
  itemKey: string;
  assigneeId: string;
  contentType: ContentType;
  itemCount: number;
  titlePattern: string;
  startMonth: string;
  generationDay: number;
  paused: boolean;
  createdBy: string;
}): string {
  const db = getDb();
  const id = input.id ?? crypto.randomUUID();
  if (input.id) {
    // Plan değişikliği yalnızca GELECEKTEKİ paketlere uygulanır: geçmiş
    // çalışmalar `monthly_task_plan_runs`ta olduğu gibi kalır.
    db.prepare(
      `UPDATE monthly_task_plans
          SET label = ?, brand_id = ?, profile = ?, item_key = ?, assignee_id = ?,
              content_type = ?, item_count = ?, title_pattern = ?, start_month = ?,
              generation_day = ?, paused = ?, updated_at = datetime('now')
        WHERE id = ?`,
    ).run(
      input.label, input.brandId, input.profile, input.itemKey, input.assigneeId,
      input.contentType, input.itemCount, input.titlePattern, input.startMonth,
      input.generationDay, input.paused ? 1 : 0, id,
    );
    return id;
  }
  db.prepare(
    `INSERT INTO monthly_task_plans
       (id, label, brand_id, profile, item_key, assignee_id, content_type,
        item_count, title_pattern, start_month, generation_day, paused, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, input.label, input.brandId, input.profile, input.itemKey, input.assigneeId,
    input.contentType, input.itemCount, input.titlePattern, input.startMonth,
    input.generationDay, input.paused ? 1 : 0, input.createdBy,
  );
  return id;
}

export function setMonthlyPlanPaused(id: string, paused: boolean): boolean {
  const result = getDb()
    .prepare("UPDATE monthly_task_plans SET paused = ?, updated_at = datetime('now') WHERE id = ?")
    .run(paused ? 1 : 0, id);
  return Number(result.changes) === 1;
}

export function deleteMonthlyTaskPlan(id: string): void {
  getDb().prepare("DELETE FROM monthly_task_plans WHERE id = ?").run(id);
}
