import { getDb, plainList } from "@/lib/db/client";
import { getTask } from "@/lib/repositories/tasks";
import { plannedTaskCondition } from "@/lib/taskPlanning";
import { parseTaskFilterParams, type TaskFilterState } from "@/lib/taskFilterParams";
import { parseTaskPage, TASK_PAGE_SIZE } from "@/lib/taskPagination";
import type { ListSort } from "@/lib/taskSort";
import { CONTENT_TYPE_LABEL } from "@/lib/constants";

const from = `FROM tasks t JOIN content_items ci ON ci.id=t.content_item_id JOIN brands b ON b.id=ci.brand_id LEFT JOIN people p ON p.id=t.assignee_id`;
const active = `t.archived_at IS NULL AND ${plannedTaskCondition("t")}`;
const department = `CASE WHEN p.department IN ('video','design','social','management') THEN p.department ELSE 'other' END`;
const priority = `CASE t.priority WHEN 'Acil' THEN 0 WHEN 'Yuksek' THEN 1 WHEN 'Normal' THEN 2 ELSE 3 END`;
const status = `CASE t.status WHEN 'Beklemede' THEN 0 WHEN 'DevamEdiyor' THEN 1 WHEN 'Incelemede' THEN 2 WHEN 'Onaylandi' THEN 3 ELSE 4 END`;
const commentCount = `(SELECT COUNT(*) FROM comments c WHERE c.task_id=t.id)`;
const revisionCount = `(SELECT COUNT(*) FROM task_revision_rounds r WHERE r.task_id=t.id)`;

/** Internal team scope, checked at the repository boundary as well as the page. */
function requireTeamPerson(personId: string) {
  const person = getDb().prepare("SELECT id,is_manager FROM people WHERE id=? AND active=1").get(personId);
  if (!person) throw new Error("Ekip oturumu gerekli.");
  return person;
}

export function listTaskPage(personId: string, filters: TaskFilterState, options: { page?: number; sort?: ListSort | null; today: string; weekEnd: string }) {
  const db = getDb(); requireTeamPerson(personId);
  // SQLite's built-in lower() does not fold Turkish I/İ correctly.
  db.function("task_fold", { deterministic: true }, (value) => String(value ?? "").toLocaleLowerCase("tr-TR"));
  const f = parseTaskFilterParams(filters);
  const args: Array<string | number> = [];
  const where = [active];
  const add = (sql: string, value?: string | number) => { where.push(sql); if (value !== undefined) args.push(value); };
  if (f.brand) add("b.id=?", f.brand);
  if (f.status) add("t.status=?", f.status);
  if (f.priority) add("t.priority=?", f.priority);
  if (f.difficulty === "unset") add("t.difficulty IS NULL");
  else if (f.difficulty) add("t.difficulty=?", f.difficulty);
  if (f.pointsMin) add("t.weight_points>=?", Number(f.pointsMin));
  if (f.pointsMax) add("t.weight_points<=?", Number(f.pointsMax));
  if (f.assignee === "__unassigned__") add("t.assignee_id IS NULL");
  else if (f.assignee) add("t.assignee_id=?", f.assignee);
  if (f.focus) add("t.status!='Yayinlandi'");
  if (f.focus === "overdue" || f.due === "overdue") add("t.due_date<?", options.today);
  if (f.due === "today") add("t.due_date=?", options.today);
  if (f.due === "undated") add("t.due_date IS NULL");
  if (f.focus === "week" || f.due === "week") { add("t.due_date>=?", options.today); add("t.due_date<=?", options.weekEnd); }
  if (f.from) add("t.due_date>=?", f.from);
  if (f.to) add("t.due_date<=?", f.to);
  if (f.q.trim()) {
    const needle = f.q.trim().toLocaleLowerCase("tr-TR");
    add("(instr(task_fold(t.title),?)>0 OR instr(task_fold(b.name),?)>0 OR instr(task_fold(ci.title),?)>0 OR instr(task_fold(p.name),?)>0)");
    args.push(needle, needle, needle, needle);
  }
  const baseWhere = where.join(" AND ");
  const departmentRows = plainList<{ department: string; total: number }>(db.prepare(`SELECT ${department} AS department,COUNT(*) AS total ${from} WHERE ${baseWhere} AND p.id IS NOT NULL GROUP BY ${department}`).all(...args));
  const allDepartments = Number(db.prepare(`SELECT COUNT(*) AS total ${from} WHERE ${baseWhere}`).get(...args)!.total);
  if (f.department) add(`p.id IS NOT NULL AND ${department}=?`, f.department);
  const clause = where.join(" AND ");
  const total = Number(db.prepare(`SELECT COUNT(*) AS total ${from} WHERE ${clause}`).get(...args)!.total);
  const totalActive = Number(db.prepare(`SELECT COUNT(*) AS total ${from} WHERE ${active}`).get()!.total);
  const pages = Math.max(1, Math.ceil(total / TASK_PAGE_SIZE));
  const page = Math.min(parseTaskPage(String(options.page ?? 1)), pages);
  const personalTarget = `(SELECT target_date FROM task_personal_targets pt WHERE pt.task_id=t.id AND pt.person_id='${personId.replaceAll("'", "''")}' AND t.assignee_id=pt.person_id)`;
  const fields: Record<string, string> = {
    gorev: "task_fold(t.title)", marka: "task_fold(b.name),task_fold(ci.title),task_fold(t.title)",
    oncelik: priority, durum: status, atanan: "task_fold(p.name)", teslim: "t.due_date", hedef: personalTarget,
    puan: "-t.weight_points", yorum: `-${commentCount}`, revize: `-${revisionCount}`,
    zorluk: `CASE t.difficulty WHEN 'Zor' THEN 0 WHEN 'Orta' THEN 1 WHEN 'Kolay' THEN 2 WHEN 'Ozel' THEN 3 ELSE 4 END`,
    tur: `CASE COALESCE(t.type_override,ci.type) ${Object.entries(CONTENT_TYPE_LABEL).map(([key,label]) => `WHEN '${key}' THEN '${label.replaceAll("'", "''")}'`).join(" ")} END`,
  };
  const empty: Record<string, string> = { atanan: "p.name IS NULL", teslim: "t.due_date IS NULL", hedef: `${personalTarget} IS NULL`, zorluk: "t.difficulty IS NULL", yorum: `${commentCount}=0`, revize: `${revisionCount}=0` };
  const sort = options.sort;
  let order = `${priority},t.due_date IS NULL,t.due_date,task_fold(b.name)`;
  if (sort && fields[sort.key]) order = `${empty[sort.key] ? `${empty[sort.key]},` : ""}${fields[sort.key].split(",task_fold").join(`${sort.dir === "desc" ? " DESC" : " ASC"},task_fold`)} ${sort.dir === "desc" ? "DESC" : "ASC"}`;
  else if (f.sort !== "varsayilan") order = `${empty[f.sort] ? `${empty[f.sort]},` : ""}${fields[f.sort]}`;
  const ids = plainList<{ id: string }>(db.prepare(`SELECT t.id ${from} WHERE ${clause} ORDER BY ${order},t.id LIMIT ? OFFSET ?`).all(...args, TASK_PAGE_SIZE, (page - 1) * TASK_PAGE_SIZE));
  // Only hydrate the selected 50 rows; long brief/notes belong to detail, never the list payload.
  const tasks = ids.map(({ id }) => {
    const task = getTask(id)!;
    const target = task.assignee_id === personId ? db.prepare("SELECT target_date FROM task_personal_targets WHERE task_id=? AND person_id=?").get(id,personId) : undefined;
    return { ...task, notes: null, guest_brief: null, title: task.title.slice(0,300), content_title: task.content_title.slice(0,300), last_comment_body: task.last_comment_body?.slice(0,160) ?? null, personal_target_date: target ? String(target.target_date) : null };
  });
  return { tasks, total, totalActive, page, pages, allDepartments, departmentCounts: Object.fromEntries(departmentRows.map(row => [row.department,row.total])) };
}

export function listPlanningPage(personId: string, requestedPage = 1) {
  const person = requireTeamPerson(personId), db = getDb();
  const clause = `t.archived_at IS NULL AND t.due_date IS NULL ${person.is_manager === 1 ? "" : "AND t.origin='guest'"}`;
  const total = Number(db.prepare(`SELECT COUNT(*) AS total ${from} WHERE ${clause}`).get()!.total);
  const pages = Math.max(1,Math.ceil(total/TASK_PAGE_SIZE)), page = Math.min(parseTaskPage(String(requestedPage)),pages);
  const tasks = plainList<{ id: string; title: string; brand_name: string; origin: string; requested_date: string | null }>(db.prepare(`SELECT t.id,substr(t.title,1,300) AS title,b.name AS brand_name,t.origin,t.requested_date ${from} WHERE ${clause} ORDER BY t.created_at,t.id LIMIT ? OFFSET ?`).all(TASK_PAGE_SIZE,(page-1)*TASK_PAGE_SIZE));
  return { tasks, total, page, pages };
}
