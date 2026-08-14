import { getDb, plainList, plainOne } from "@/lib/db/client";
import { DEPARTMENTS, NO_DEPARTMENT, type DepartmentKey } from "@/lib/departments";
import type { Person } from "@/lib/types";

const PUBLIC_PERSON_COLUMNS =
  "id, name, title, bio, avatar_path, department, is_manager, active";
const PUBLIC_PERSON_COLUMNS_WITH_ALIAS =
  "p.id, p.name, p.title, p.bio, p.avatar_path, p.department, p.is_manager, p.active";

export interface LoginPerson extends Person {
  has_password: number;
}

interface PersonCredentials {
  id: string;
  password_hash: string | null;
  active: number;
}

// `DEPARTMENTS` id'leri kod sabiti (kullanıcı girdisi DEĞİL), bu yüzden SQL'e
// doğrudan gömülüyor — parametre listesi departman sayısına göre değişken
// uzunlukta olurdu ve her sorguda ayrı ayrı bağlanması gerekirdi.
const KNOWN_DEPARTMENT_LIST = DEPARTMENTS.map((department) => `'${department.id}'`).join(", ");

/**
 * `people.department` değerini rapor kovasına çevirir: tanınmayan ya da boş
 * değerlerin hepsi "Diğer"e düşer — arayüzdeki `departmentKey()` ile aynı kural,
 * sadece SQL tarafında. `column` tam sütun adı olmalı (`p.department` gibi).
 */
export function departmentBucketExpression(column: string): string {
  return `CASE WHEN ${column} IN (${KNOWN_DEPARTMENT_LIST})
            THEN ${column} ELSE '${NO_DEPARTMENT}' END`;
}

/**
 * Verilen departmandaki kişileri seçen koşul. Departman GÖREVİN değil KİŞİNİN
 * alanı olduğu için görev sorguları bu alt sorguyla daraltılıyor; `column`
 * çağıranın atanan sütunu (`t.assignee_id` gibi). Sonuç olarak **atanmamış
 * görevler hiçbir departmanın raporuna girmez**.
 *
 * Gerçek bir departman id'si için sorgu `:department` adlı parametreyi bekler
 * ("Diğer" kovası parametresizdir — koşul sabit bir NOT IN listesi).
 */
export function departmentPeopleCondition(department: DepartmentKey, column: string): string {
  return department === NO_DEPARTMENT
    ? `${column} IN (SELECT id FROM people
                      WHERE department IS NULL
                         OR department NOT IN (${KNOWN_DEPARTMENT_LIST}))`
    : `${column} IN (SELECT id FROM people WHERE department = :department)`;
}

export function listActivePeople(): Person[] {
  return plainList<Person>(
    getDb()
      .prepare(`SELECT ${PUBLIC_PERSON_COLUMNS} FROM people WHERE active = 1 ORDER BY name`)
      .all(),
  );
}

// Otomatik üretilen bildirimlerin (ör. sosyal medya sessizlik uyarısı) alıcısı:
// bir görev/yorum söz konusu olmadığı için kişiye özel bir muhatap yok.
// Yöneticiler + işi fiilen yapan Sosyal Medya ekibi; `OR` olduğu için ikisinde
// birden olan kişi tek kayıt döner (aynı bildirimi iki kez almasın).
export function listSocialAlertRecipients(): Person[] {
  return plainList<Person>(
    getDb()
      .prepare(
        `SELECT ${PUBLIC_PERSON_COLUMNS} FROM people
          WHERE active = 1 AND (is_manager = 1 OR department = 'social')
          ORDER BY name`,
      )
      .all(),
  );
}

export function getPerson(id: string): Person | undefined {
  return plainOne<Person>(
    getDb().prepare(`SELECT ${PUBLIC_PERSON_COLUMNS} FROM people WHERE id = ?`).get(id),
  );
}

export function listInactivePeople(): Person[] {
  return plainList<Person>(
    getDb()
      .prepare(`SELECT ${PUBLIC_PERSON_COLUMNS} FROM people WHERE active = 0 ORDER BY name`)
      .all(),
  );
}

export function listLoginPeople(): LoginPerson[] {
  return plainList<LoginPerson>(
    getDb()
      .prepare(
        `SELECT ${PUBLIC_PERSON_COLUMNS_WITH_ALIAS},
                CASE WHEN a.password_hash IS NULL THEN 0 ELSE 1 END AS has_password
           FROM people p
           LEFT JOIN accounts a ON a.kind = 'team' AND a.person_id = p.id
          WHERE p.active = 1
          ORDER BY p.name`,
      )
      .all(),
  );
}

export function getPersonCredentials(id: string): PersonCredentials | undefined {
  return plainOne<PersonCredentials>(
    getDb()
      .prepare(
        `SELECT p.id, COALESCE(a.password_hash, p.password_hash) AS password_hash,
                CASE WHEN p.active = 1 AND COALESCE(a.active, 1) = 1 THEN 1 ELSE 0 END AS active
           FROM people p
           LEFT JOIN accounts a ON a.kind = 'team' AND a.person_id = p.id
          WHERE p.id = ?`,
      )
      .get(id),
  );
}

// Ekip giriş ekranı oturum açılmadan kişi listesini göstermediği için yazılan
// kimlik hem people.id hem de tam ad olabilir. SQLite NOCASE yalnızca ASCII
// harfleri güvenilir biçimde katladığından Türkçe karşılaştırma JS tarafında
// yapılır. Pasif ve şifresiz hesaplar bilerek burada elenmez; giriş action'ı
// bunların tamamını tek jenerik hata arkasında birleştirir.
export function findLoginCandidate(identifier: string): PersonCredentials | undefined {
  const needle = identifier.trim().toLocaleLowerCase("tr-TR");
  if (!needle) return undefined;

  const rows = plainList<PersonCredentials & { name: string }>(
    getDb()
      .prepare(
        `SELECT p.id, p.name,
                COALESCE(a.password_hash, p.password_hash) AS password_hash,
                CASE WHEN p.active = 1 AND COALESCE(a.active, 1) = 1 THEN 1 ELSE 0 END AS active
           FROM people p
           LEFT JOIN accounts a ON a.kind = 'team' AND a.person_id = p.id`,
      )
      .all(),
  );

  return (
    rows.find((row) => row.id.toLocaleLowerCase("tr-TR") === needle) ??
    rows.find((row) => row.name.trim().toLocaleLowerCase("tr-TR") === needle)
  );
}

export function createPerson(
  name: string,
  department: string | null,
  passwordHash: string,
): string {
  const id = crypto.randomUUID();
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      "INSERT INTO people (id, name, department, password_hash) VALUES (?, ?, ?, ?)",
    ).run(id, name, department, passwordHash);
    db.prepare(
      `INSERT INTO accounts
         (id, kind, person_id, brand_id, username, password_hash, active)
       VALUES (?, 'team', ?, NULL, NULL, ?, 1)`,
    ).run(`team:${id}`, id, passwordHash);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return id;
}

export function updatePersonPassword(id: string, passwordHash: string): void {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE people SET password_hash = ? WHERE id = ?").run(passwordHash, id);
    db.prepare(
      `UPDATE accounts
          SET password_hash = ?, updated_at = datetime('now')
        WHERE kind = 'team' AND person_id = ?`,
    ).run(passwordHash, id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function updatePersonProfile(input: {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  department: string | null;
  avatarPath: string | null;
}): void {
  getDb()
    .prepare(
      `UPDATE people
          SET name = ?, title = ?, bio = ?, department = ?, avatar_path = ?
        WHERE id = ?`,
    )
    .run(
      input.name,
      input.title,
      input.bio,
      input.department,
      input.avatarPath,
      input.id,
    );
}

export function setPersonActive(id: string, active: boolean): void {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE people SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
    db.prepare(
      "UPDATE accounts SET active = ?, updated_at = datetime('now') WHERE kind = 'team' AND person_id = ?",
    ).run(active ? 1 : 0, id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function setPersonManager(id: string, isManager: boolean): void {
  getDb()
    .prepare("UPDATE people SET is_manager = ? WHERE id = ?")
    .run(isManager ? 1 : 0, id);
}
