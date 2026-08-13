import { getDb, plainList } from "@/lib/db/client";
import type { Brand, IdeaWithContext, TaskWithContext } from "@/lib/types";
import { plannedTaskCondition, visibleContentCondition } from "@/lib/taskPlanning";

export interface ContentSearchResult {
  id: string;
  brand_id: string;
  brand_name: string;
  title: string;
}

export interface SearchResults {
  brands: Brand[];
  content: ContentSearchResult[];
  tasks: TaskWithContext[];
  ideas: IdeaWithContext[];
}

const RESULT_LIMIT = 20;

// SQLite'ın `LIKE ... COLLATE NOCASE`'i yalnızca ASCII a-z/A-Z'yi katlar — "İ"/"ı"
// gibi Türkçe harfler eşleşmiyordu (küçük harfle "şantiye" aratan kişi hiç sonuç
// bulamıyordu). Veri hacmi küçük olduğu için (portföy genelinde onlarca satır)
// SQL'de filtrelemek yerine ilgili sütunları çekip `toLocaleLowerCase("tr-TR")`
// ile JS tarafında karşılaştırıyoruz — /tasks'taki client-side arama zaten aynı
// deseni kullanıyor (components/TaskExplorer.tsx).
function turkishIncludes(haystack: string, needleLower: string): boolean {
  return haystack.toLocaleLowerCase("tr-TR").includes(needleLower);
}

export function searchAll(query: string): SearchResults {
  const q = query.trim();
  if (!q) return { brands: [], content: [], tasks: [], ideas: [] };
  const needle = q.toLocaleLowerCase("tr-TR");
  const db = getDb();

  const allBrands = plainList<Brand>(
    db.prepare(`SELECT * FROM brands WHERE archived = 0 ORDER BY name`).all(),
  );
  const brands = allBrands
    .filter(
      (b) =>
        turkishIncludes(b.name, needle) ||
        (b.instagram_handle && turkishIncludes(b.instagram_handle, needle)),
    )
    .slice(0, RESULT_LIMIT);

  const allContent = plainList<ContentSearchResult>(
    db
      .prepare(
        `SELECT ci.id, ci.brand_id, b.name AS brand_name, ci.title
         FROM content_items ci
         JOIN brands b ON b.id = ci.brand_id
         WHERE ${visibleContentCondition("ci")}
         ORDER BY ci.title`,
      )
      .all(),
  );
  const content = allContent
    .filter((c) => turkishIncludes(c.title, needle))
    .slice(0, RESULT_LIMIT);

  const allTasks = plainList<TaskWithContext>(
    db
      .prepare(
        `SELECT t.*, p.name AS assignee_name,
                p.avatar_path AS assignee_avatar_path,
                ci.title AS content_title, ci.type AS content_type,
                b.id AS brand_id, b.name AS brand_name
         FROM tasks t
         JOIN content_items ci ON ci.id = t.content_item_id
         JOIN brands b ON b.id = ci.brand_id
         LEFT JOIN people p ON p.id = t.assignee_id
         WHERE ${plannedTaskCondition("t")}
         ORDER BY t.title`,
      )
      .all(),
  );
  const tasks = allTasks
    .filter(
      (t) =>
        turkishIncludes(t.title, needle) ||
        (t.notes && turkishIncludes(t.notes, needle)),
    )
    .slice(0, RESULT_LIMIT);

  const allIdeas = plainList<IdeaWithContext>(
    db.prepare(
      `SELECT i.*, CASE
                WHEN i.scope_type = 'brand' THEN COALESCE(b.name, i.brand_name_snapshot)
                ELSE NULL
              END AS brand_name
         FROM ideas i
         LEFT JOIN brands b ON b.id = i.brand_id
        WHERE i.archived_at IS NULL
        ORDER BY i.updated_at DESC`,
    ).all(),
  );
  const ideas = allIdeas
    .filter((idea) => turkishIncludes([
      idea.title,
      idea.body,
      idea.brand_name,
      idea.tags_text,
    ].filter(Boolean).join(" "), needle))
    .slice(0, RESULT_LIMIT);

  return { brands, content, tasks, ideas };
}
