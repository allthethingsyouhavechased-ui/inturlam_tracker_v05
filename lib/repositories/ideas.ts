import type { DatabaseSync } from "node:sqlite";
import { getDb, plainList, plainOne } from "@/lib/db/client";
import type {
  IdeaCategory,
  IdeaSourcePlatform,
  IdeaStatus,
  IdeaWithContext,
} from "@/lib/types";

const IDEA_WITH_CONTEXT = `
  SELECT i.*, CASE
           WHEN i.scope_type = 'brand' THEN COALESCE(b.name, i.brand_name_snapshot)
           ELSE NULL
         END AS brand_name
    FROM ideas i
    LEFT JOIN brands b ON b.id = i.brand_id
`;

function resolveScope(db: DatabaseSync, brandId: string | null): {
  scopeType: "office" | "brand";
  brandId: string | null;
  brandName: string | null;
} {
  if (!brandId) return { scopeType: "office", brandId: null, brandName: null };
  const brand = plainOne<{ id: string; name: string }>(
    db.prepare("SELECT id, name FROM brands WHERE id = ? AND archived = 0").get(brandId),
  );
  if (!brand) throw new Error("Fikir için geçerli bir marka seçilmeli.");
  return { scopeType: "brand", brandId: brand.id, brandName: brand.name };
}

export function listIdeas(archived = false): IdeaWithContext[] {
  return plainList<IdeaWithContext>(getDb().prepare(
    `${IDEA_WITH_CONTEXT}
      WHERE i.archived_at IS ${archived ? "NOT NULL" : "NULL"}
      ORDER BY i.updated_at DESC, i.rowid DESC`,
  ).all());
}

export function getIdea(id: string): IdeaWithContext | undefined {
  return plainOne<IdeaWithContext>(
    getDb().prepare(`${IDEA_WITH_CONTEXT} WHERE i.id = ?`).get(id),
  );
}

export function countArchivedIdeas(): number {
  return Number(
    (getDb().prepare("SELECT COUNT(*) AS n FROM ideas WHERE archived_at IS NOT NULL").get() as { n: number }).n,
  );
}

export function countIdeasForBrand(brandId: string, archived = false): number {
  const row = plainOne<{ count: number }>(
    getDb()
      .prepare(
        `SELECT COUNT(*) AS count FROM ideas
          WHERE brand_id = ? AND ${archived ? "archived_at IS NOT NULL" : "archived_at IS NULL"}`,
      )
      .get(brandId),
  );
  return row?.count ?? 0;
}

export function createIdea(input: {
  brandId: string | null;
  category: IdeaCategory;
  status: IdeaStatus;
  title: string;
  body: string;
  sourceUrl: string | null;
  sourcePlatform: IdeaSourcePlatform | null;
  tagsText: string | null;
  createdById: string;
  createdByName: string;
}): string {
  const db = getDb();
  const scope = resolveScope(db, input.brandId);
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO ideas
       (id, scope_type, brand_id, brand_name_snapshot, category, status,
        title, body, source_url, source_platform, tags_text,
        created_by_id, created_by_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    scope.scopeType,
    scope.brandId,
    scope.brandName,
    input.category,
    input.status,
    input.title,
    input.body,
    input.sourceUrl,
    input.sourcePlatform,
    input.tagsText,
    input.createdById,
    input.createdByName,
  );
  return id;
}

export function updateIdea(input: {
  id: string;
  brandId: string | null;
  category: IdeaCategory;
  status: IdeaStatus;
  title: string;
  body: string;
  sourceUrl: string | null;
  sourcePlatform: IdeaSourcePlatform | null;
  tagsText: string | null;
}): void {
  const db = getDb();
  const scope = resolveScope(db, input.brandId);
  const result = db.prepare(
    `UPDATE ideas
        SET scope_type = ?, brand_id = ?, brand_name_snapshot = ?, category = ?,
            status = ?, title = ?, body = ?, source_url = ?, source_platform = ?,
            tags_text = ?, updated_at = datetime('now')
      WHERE id = ? AND archived_at IS NULL`,
  ).run(
    scope.scopeType,
    scope.brandId,
    scope.brandName,
    input.category,
    input.status,
    input.title,
    input.body,
    input.sourceUrl,
    input.sourcePlatform,
    input.tagsText,
    input.id,
  );
  if (result.changes !== 1) throw new Error("Fikir bulunamadı veya arşivde.");
}

export function updateIdeaStatus(id: string, status: IdeaStatus): void {
  const result = getDb().prepare(
    "UPDATE ideas SET status = ?, updated_at = datetime('now') WHERE id = ? AND archived_at IS NULL",
  ).run(status, id);
  if (result.changes !== 1) throw new Error("Fikir bulunamadı veya arşivde.");
}

export function setIdeaArchived(id: string, archived: boolean): void {
  const result = getDb().prepare(
    `UPDATE ideas
        SET archived_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END,
            updated_at = datetime('now')
      WHERE id = ?`,
  ).run(archived ? 1 : 0, id);
  if (result.changes !== 1) throw new Error("Fikir bulunamadı.");
}
