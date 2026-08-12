import { getDb, plainList, plainOne } from "@/lib/db/client";
import type {
  ContentType,
  TaskPriority,
  TaskTemplate,
  TaskTemplateItem,
  TaskTemplateWithItems,
} from "@/lib/types";

// Görev şablonları. `lib/repositories/clusters.ts` ile aynı desen: tüm SQL
// burada, her okuma plainList/plainOne'dan geçiyor (null-prototype satırlar
// Server→Client sınırını geçemez).

export function listTemplates(): TaskTemplate[] {
  return plainList<TaskTemplate>(
    getDb().prepare("SELECT * FROM task_templates ORDER BY sort_order, name").all(),
  );
}

export function listTemplatesForContentType(contentType: ContentType): TaskTemplate[] {
  return plainList<TaskTemplate>(
    getDb()
      .prepare(
        `SELECT * FROM task_templates
          WHERE content_type IS NULL OR content_type = ?
          ORDER BY sort_order, name`,
      )
      .all(contentType),
  );
}

export function listTemplateItems(templateId: string): TaskTemplateItem[] {
  return plainList<TaskTemplateItem>(
    getDb()
      .prepare(
        "SELECT * FROM task_template_items WHERE template_id = ? ORDER BY sort_order, title",
      )
      .all(templateId),
  );
}

export function listTemplatesWithItems(): TaskTemplateWithItems[] {
  // Şablon sayısı bir avuç (ajans iş akışları) — N+1 burada bilinçli bir
  // tercih: tek sorguyu elle gruplamaktan daha okunaklı.
  return listTemplates().map((t) => ({ ...t, items: listTemplateItems(t.id) }));
}

export function getTemplate(id: string): TaskTemplate | undefined {
  return plainOne<TaskTemplate>(
    getDb().prepare("SELECT * FROM task_templates WHERE id = ?").get(id),
  );
}

export function createTemplate(input: {
  name: string;
  contentType: ContentType | null;
}): string {
  const db = getDb();
  const id = crypto.randomUUID();
  const { maxOrder } = plainOne<{ maxOrder: number | null }>(
    db.prepare("SELECT MAX(sort_order) AS maxOrder FROM task_templates").get(),
  )!;
  db.prepare(
    "INSERT INTO task_templates (id, name, content_type, sort_order) VALUES (?, ?, ?, ?)",
  ).run(id, input.name, input.contentType, (maxOrder ?? 0) + 10);
  return id;
}

export function renameTemplate(id: string, name: string, contentType: ContentType | null): void {
  getDb()
    .prepare("UPDATE task_templates SET name = ?, content_type = ? WHERE id = ?")
    .run(name, contentType, id);
}

export function deleteTemplate(id: string): void {
  // Satırlar ON DELETE CASCADE ile düşer.
  getDb().prepare("DELETE FROM task_templates WHERE id = ?").run(id);
}

export function addTemplateItem(input: {
  templateId: string;
  title: string;
  priority: TaskPriority;
  dueOffsetDays: number | null;
}): string {
  const db = getDb();
  const id = crypto.randomUUID();
  const { maxOrder } = plainOne<{ maxOrder: number | null }>(
    db
      .prepare("SELECT MAX(sort_order) AS maxOrder FROM task_template_items WHERE template_id = ?")
      .get(input.templateId),
  )!;
  db.prepare(
    `INSERT INTO task_template_items
       (id, template_id, title, priority, due_offset_days, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.templateId,
    input.title,
    input.priority,
    input.dueOffsetDays,
    (maxOrder ?? 0) + 10,
  );
  return id;
}

export function deleteTemplateItem(id: string): void {
  getDb().prepare("DELETE FROM task_template_items WHERE id = ?").run(id);
}

// Şablonu bir içeriğe uygular: her satır için görev açar. Tarihler içeriğin
// target_date'ine göre kaydırılır (due_offset_days). İçeriğin tarihi yoksa
// şablon uygulanmaz; kullanıcıdan önce gerçek hedef tarih istenir.
// Tek transaction: yarım uygulanmış bir şablon bırakmıyoruz.
export function applyTemplateToContent(input: {
  templateId: string;
  contentItemId: string;
  defaultAssigneeId: string | null;
}): number {
  const db = getDb();
  const items = listTemplateItems(input.templateId);
  if (items.length === 0) return 0;

  const content = plainOne<{ target_date: string | null }>(
    db.prepare("SELECT target_date FROM content_items WHERE id = ?").get(input.contentItemId),
  );
  if (!content) throw new Error("İçerik bulunamadı.");
  if (!content.target_date) throw new Error("Şablonu uygulamadan önce içerik hedef tarihini belirleyin.");

  const insert = db.prepare(
    `INSERT INTO tasks (id, content_item_id, title, priority, assignee_id, due_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  db.exec("BEGIN");
  try {
    for (const item of items) {
      insert.run(
        crypto.randomUUID(),
        input.contentItemId,
        item.title,
        item.priority,
        item.assignee_id ?? input.defaultAssigneeId,
        shiftDate(content.target_date, item.due_offset_days ?? 0),
      );
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return items.length;
}

// 'YYYY-MM-DD' + gün → 'YYYY-MM-DD'. UTC üzerinden hesaplanıyor: yerel saat
// dilimi/DST kayması bir günlük hatalara yol açmasın.
export function shiftDate(base: string | null, offsetDays: number | null): string | null {
  // Saf yardımcı null ofseti null bırakır. Uygulama akışı eski null kayıtları
  // teslim günü (0) olarak normalize eder; yeni tarihsiz görev oluşturulmaz.
  if (!base || offsetDays === null) return null;
  const d = new Date(`${base}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
