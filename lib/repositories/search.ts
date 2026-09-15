import { getDb, plainList } from "@/lib/db/client";
import type { Brand, IdeaWithContext, TaskWithContext } from "@/lib/types";
import { plannedTaskCondition, visibleContentCondition } from "@/lib/taskPlanning";

export interface ContentSearchResult {
  id: string;
  brand_id: string;
  brand_name: string;
  title: string;
}

export interface PersonSearchResult {
  id: string;
  name: string;
  title: string | null;
  department: string | null;
  avatar_path: string | null;
  open_task_count: number;
}

export interface SearchResults {
  brands: Brand[];
  content: ContentSearchResult[];
  tasks: TaskWithContext[];
  people: PersonSearchResult[];
  ideas: IdeaWithContext[];
  /** Kesilmeden ÖNCEki eşleşme sayıları — "tüm sonuçlar" bağlantısı gerçek
      sayıyı göstersin, önizleme sınırını değil. */
  totals: { brands: number; content: number; tasks: number; people: number; ideas: number };
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

function emptyResults(): SearchResults {
  return {
    brands: [],
    content: [],
    tasks: [],
    people: [],
    ideas: [],
    totals: { brands: 0, content: 0, tasks: 0, people: 0, ideas: 0 },
  };
}

export function searchAll(query: string): SearchResults {
  const q = query.trim();
  if (!q) return emptyResults();
  const needle = q.toLocaleLowerCase("tr-TR");
  const db = getDb();

  const allBrands = plainList<Brand>(
    db.prepare(`SELECT * FROM brands WHERE archived = 0 ORDER BY name`).all(),
  );
  const matchedBrands = allBrands.filter(
    (b) =>
      turkishIncludes(b.name, needle) ||
      (b.instagram_handle && turkishIncludes(b.instagram_handle, needle)),
  );
  const brands = matchedBrands.slice(0, RESULT_LIMIT);

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
  const matchedContent = allContent.filter((c) => turkishIncludes(c.title, needle));
  const content = matchedContent.slice(0, RESULT_LIMIT);

  const allTasks = plainList<TaskWithContext>(
    db
      .prepare(
        `SELECT t.*, p.name AS assignee_name,
                p.avatar_path AS assignee_avatar_path,
                ci.title AS content_title, COALESCE(t.type_override, ci.type) AS content_type,
                b.id AS brand_id, b.name AS brand_name, b.accent_hue AS brand_accent_hue
         FROM tasks t
         JOIN content_items ci ON ci.id = t.content_item_id
         JOIN brands b ON b.id = ci.brand_id
         LEFT JOIN people p ON p.id = t.assignee_id
         WHERE ${plannedTaskCondition("t")}
         ORDER BY t.title`,
      )
      .all(),
  );
  // Sorumlunun adı SORGUYA ALINIYOR ama eşleşmeye katılmıyordu: "Ekin" araması
  // Ekin'in işlerini hiç bulmuyordu. Ad artık başlık/not ile aynı sırada denenir.
  const matchedTasks = allTasks.filter(
    (t) =>
      turkishIncludes(t.title, needle) ||
      (t.notes && turkishIncludes(t.notes, needle)) ||
      (t.assignee_name && turkishIncludes(t.assignee_name, needle)),
  );
  const tasks = matchedTasks.slice(0, RESULT_LIMIT);

  // Kişi sonuçları: benzer adlar (ör. "Yunus" / "Yunus Emre") ayrı satır olarak
  // görünsün ve her biri kendi id'siyle filtrelenmiş göreve listesine bağlansın.
  const allPeople = plainList<PersonSearchResult & { username: string | null }>(
    db
      .prepare(
        `SELECT p.id, p.username, p.name, p.title, p.department, p.avatar_path,
                (SELECT COUNT(*) FROM tasks t
                   JOIN content_items ci ON ci.id = t.content_item_id
                  WHERE t.assignee_id = p.id AND t.status <> 'Yayinlandi'
                    AND t.archived_at IS NULL AND ci.archived = 0) AS open_task_count
           FROM people p
          WHERE p.active = 1
          ORDER BY p.name`,
      )
      .all(),
  );
  const matchedPeople = allPeople.filter(
    (person) =>
      turkishIncludes(person.name, needle) ||
      (person.username && turkishIncludes(person.username, needle)),
  );
  const people: PersonSearchResult[] = matchedPeople
    .slice(0, RESULT_LIMIT)
    .map((person) => ({
      id: person.id,
      name: person.name,
      title: person.title,
      department: person.department,
      avatar_path: person.avatar_path,
      open_task_count: person.open_task_count,
    }));

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
  const matchedIdeas = allIdeas.filter((idea) => turkishIncludes([
    idea.title,
    idea.body,
    idea.brand_name,
    idea.tags_text,
  ].filter(Boolean).join(" "), needle));
  const ideas = matchedIdeas.slice(0, RESULT_LIMIT);

  return {
    brands,
    content,
    tasks,
    people,
    ideas,
    totals: {
      brands: matchedBrands.length,
      content: matchedContent.length,
      tasks: matchedTasks.length,
      people: matchedPeople.length,
      ideas: matchedIdeas.length,
    },
  };
}
