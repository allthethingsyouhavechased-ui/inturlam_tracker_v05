import type { DatabaseSync } from "node:sqlite";
import { getDb, plainList, plainOne } from "@/lib/db/client";
import { istanbulMonth } from "@/lib/points/period";
import type { PointProfile, PointScope } from "@/lib/points/catalog";

export interface PointPackageRow {
  id: string;
  scope_key: string;
  profile: PointProfile;
  scope: PointScope;
  brand_id: string | null;
  person_id: string;
  plan_month: string;
  item_key: string;
  catalog_version_id: string;
  required_count: number;
  amount_units: number;
  status: "Acik" | "Tamamlandi" | "Iptal";
  scope_change_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface PointPackageProgress extends PointPackageRow {
  member_count: number;
  approved_count: number;
  brand_name: string | null;
  person_name: string;
}

/**
 * Paket tekilleştirme anahtarı. Marka kapsamında paket sınırı
 * departman(profil) + marka + plan ayı + iş kalemi; kişi kapsamında (AI)
 * kişi + ay + kalem — marka çarpanı YOKTUR.
 */
export function packageScopeKey(input: {
  profile: PointProfile;
  scope: PointScope;
  brandId: string | null;
  personId: string;
  planMonth: string;
  itemKey: string;
}): string {
  const anchor = input.scope === "brand" ? `brand:${input.brandId}` : `person:${input.personId}`;
  return `${input.profile}|${anchor}|${input.planMonth}|${input.itemKey}`;
}

const PROGRESS_SELECT = `
  SELECT p.*,
         (SELECT COUNT(*) FROM point_package_members m WHERE m.package_id = p.id) AS member_count,
         (SELECT COUNT(*) FROM point_package_members m
            JOIN tasks t ON t.id = m.task_id
           WHERE m.package_id = p.id
             AND t.status IN ('Onaylandi','MusteriIncelemede','MusteriOnayladi','Yayinlandi')
         ) AS approved_count,
         b.name AS brand_name,
         pe.name AS person_name
    FROM point_packages p
    LEFT JOIN brands b ON b.id = p.brand_id
    JOIN people pe ON pe.id = p.person_id
`;

export function listPointPackagesForMonth(month: string): PointPackageProgress[] {
  return plainList<PointPackageProgress>(
    getDb().prepare(`${PROGRESS_SELECT} WHERE p.plan_month = ? ORDER BY pe.name, p.profile, p.item_key`).all(month),
  );
}

export function listPointPackagesForPerson(personId: string, month: string): PointPackageProgress[] {
  return plainList<PointPackageProgress>(
    getDb()
      .prepare(`${PROGRESS_SELECT} WHERE p.person_id = ? AND p.plan_month = ? ORDER BY p.profile, p.item_key`)
      .all(personId, month),
  );
}

export function getPointPackage(id: string): PointPackageProgress | undefined {
  return plainOne<PointPackageProgress>(
    getDb().prepare(`${PROGRESS_SELECT} WHERE p.id = ?`).get(id),
  );
}

/**
 * Paketi ve SABİT üyelik listesini tek transaction'da yazar. Aynı kapsam için
 * ikinci bir paket açılamaz (scope_key UNIQUE) — eşzamanlı istek veya çift
 * tıklama yeni kopya üretmez.
 */
export function createPointPackage(input: {
  profile: PointProfile;
  scope: PointScope;
  brandId: string | null;
  personId: string;
  planMonth: string;
  itemKey: string;
  catalogVersionId: string;
  requiredCount: number;
  amountUnits: number;
  taskIds: string[];
  createdBy: string;
}): string {
  const db = getDb();
  const id = crypto.randomUUID();
  const scopeKey = packageScopeKey(input);
  db.exec("BEGIN IMMEDIATE");
  try {
    if (db.prepare("SELECT 1 FROM point_packages WHERE scope_key = ?").get(scopeKey)) {
      throw new Error("Bu kapsam için zaten bir puan paketi var.");
    }
    db.prepare(
      `INSERT INTO point_packages
         (id, scope_key, profile, scope, brand_id, person_id, plan_month, item_key,
          catalog_version_id, required_count, amount_units, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id, scopeKey, input.profile, input.scope, input.brandId, input.personId,
      input.planMonth, input.itemKey, input.catalogVersionId, input.requiredCount,
      input.amountUnits, input.createdBy,
    );
    const insertMember = db.prepare(
      "INSERT OR IGNORE INTO point_package_members (package_id, task_id) VALUES (?, ?)",
    );
    for (const taskId of [...new Set(input.taskIds)]) insertMember.run(id, taskId);
    db.exec("COMMIT");
    return id;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Bir görevin EKİP onayı geçerli mi. Müşteri onayı ve yayın BEKLENMEZ:
 * hak ediş son EKİP onayına bağlıdır.
 */
const TEAM_APPROVED_STATUSES = ["Onaylandi", "MusteriIncelemede", "MusteriOnayladi", "Yayinlandi"];

function isTeamApproved(status: string): boolean {
  return TEAM_APPROVED_STATUSES.includes(status);
}

export interface PackageSettlement {
  packageId: string;
  personId: string;
  /** Hak edişin yazıldığı ay (İstanbul takvimi) ya da terslemede kaynağın ayı. */
  period: string;
  amountUnits: number;
  action: "earned" | "reversed" | "unchanged";
}

/**
 * Paketin hak edişini YENİDEN DEĞERLENDİRİR. Her durum değişikliğinden sonra
 * çağrılır ve tek gerçeği uygular:
 *
 *  - Bütün üyeler ekipçe onaylıysa TAM tutar bir kez yazılır; hak ediş ayı,
 *    paketi tamamlayan SON ekip onayının İstanbul takvim ayıdır.
 *  - Üyelerden birinin onayı geçersizleşirse hak ediş TERSLENİR (kayıt
 *    silinmez, gerekçeli ters kayıt yazılır).
 *  - Paket yeniden tamamlanırsa yalnızca TEK net hak ediş kalır ve son ekip
 *    onayının ayına yazılır.
 *
 * Çağıranın açtığı transaction içinde çalışır.
 */
export function settlePackage(db: DatabaseSync, packageId: string): PackageSettlement {
  const pkg = db.prepare("SELECT * FROM point_packages WHERE id = ?").get(packageId) as PointPackageRow | undefined;
  if (!pkg) throw new Error("Puan paketi bulunamadı.");

  const members = db
    .prepare(
      `SELECT t.id, t.status,
              (SELECT MAX(e.created_at) FROM task_status_events e
                WHERE e.task_id = t.id AND e.to_status = 'Onaylandi') AS approved_at
         FROM point_package_members m
         JOIN tasks t ON t.id = m.task_id
        WHERE m.package_id = ?`,
    )
    .all(packageId) as { id: string; status: string; approved_at: string | null }[];

  const entryKey = `package:${packageId}`;
  const existing = db
    .prepare("SELECT id, period, amount_units FROM point_ledger WHERE entry_key = ?")
    .get(entryKey) as { id: string; period: string; amount_units: number } | undefined;
  const reversed = existing
    ? Boolean(db.prepare("SELECT 1 FROM point_ledger WHERE reverses_id = ?").get(existing.id))
    : false;
  const activeEarning = existing && !reversed;

  // Eksik paket: hiç üye yoksa da tamamlanmış sayılmaz.
  const complete = members.length >= pkg.required_count
    && members.length > 0
    && members.every((member) => isTeamApproved(member.status));

  if (complete) {
    if (activeEarning) return { packageId, personId: pkg.person_id, period: existing!.period, amountUnits: existing!.amount_units, action: "unchanged" };
    // Hak ediş ayı: paketi TAMAMLAYAN son ekip onayının İstanbul takvim ayı.
    const lastApproval = members
      .map((member) => member.approved_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);
    const period = istanbulMonth(lastApproval ?? new Date().toISOString());
    // Yeniden tamamlanma: eski kayıt terslenmiş durumda, yeni bir hak ediş
    // yazılıyor — net toplam tek hak ediş kalıyor.
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO point_ledger
         (id, entry_key, person_id, period, source_type, source_id, item_key, amount_units, reason)
       VALUES (?, ?, ?, ?, 'package', ?, ?, ?, ?)`,
    ).run(
      id,
      reversed ? `${entryKey}:${id}` : entryKey,
      pkg.person_id,
      period,
      packageId,
      pkg.item_key,
      pkg.amount_units,
      "Paket tamamlandı (tüm teslimler ekipçe onaylandı).",
    );
    db.prepare(
      "UPDATE point_packages SET status = 'Tamamlandi', updated_at = datetime('now') WHERE id = ?",
    ).run(packageId);
    return { packageId, personId: pkg.person_id, period, amountUnits: pkg.amount_units, action: "earned" };
  }

  db.prepare(
    "UPDATE point_packages SET status = 'Acik', updated_at = datetime('now') WHERE id = ?",
  ).run(packageId);

  if (!activeEarning) {
    return { packageId, personId: pkg.person_id, period: pkg.plan_month, amountUnits: 0, action: "unchanged" };
  }

  // Hak ediş geçersizleşti: ters kayıt ESKİ dönemin ayına yazılır ki geçmiş
  // rapor düzeltmesi görünür olsun.
  db.prepare(
    `INSERT INTO point_ledger
       (id, person_id, period, source_type, source_id, item_key, amount_units, reason, reverses_id)
     VALUES (?, ?, ?, 'correction', ?, ?, ?, ?, ?)`,
  ).run(
    crypto.randomUUID(),
    pkg.person_id,
    existing!.period,
    packageId,
    pkg.item_key,
    -existing!.amount_units,
    "Paket üyelerinden birinin ekip onayı geçersizleşti.",
    existing!.id,
  );
  return {
    packageId,
    personId: pkg.person_id,
    period: existing!.period,
    amountUnits: -existing!.amount_units,
    action: "reversed",
  };
}

/** Bir görevi içeren TÜM paketleri yeniden değerlendirir (durum değişiminde). */
export function settlePackagesForTask(db: DatabaseSync, taskId: string): PackageSettlement[] {
  const rows = db
    .prepare("SELECT package_id FROM point_package_members WHERE task_id = ?")
    .all(taskId) as { package_id: string }[];
  return rows.map((row) => settlePackage(db, row.package_id));
}

/**
 * Paket kapsamını değiştirir (üye ekleme/çıkarma). Gerekçe ZORUNLU ve
 * `required_count` KÜÇÜLTÜLEMEZ: sessiz adet küçültmeyle eksik paket
 * "tamamlanmış" yapılamasın.
 */
export function updatePointPackageMembers(input: {
  packageId: string;
  taskIds: string[];
  reason: string;
  actorId: string;
}): void {
  if (!input.reason.trim()) throw new Error("Kapsam değişikliği için gerekçe zorunlu.");
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const pkg = db.prepare("SELECT * FROM point_packages WHERE id = ?").get(input.packageId) as PointPackageRow | undefined;
    if (!pkg) throw new Error("Puan paketi bulunamadı.");
    const unique = [...new Set(input.taskIds)];
    if (unique.length < pkg.required_count) {
      throw new Error(`Paket en az ${pkg.required_count} iş içermeli; adet küçültülerek puan doğurulamaz.`);
    }
    db.prepare("DELETE FROM point_package_members WHERE package_id = ?").run(input.packageId);
    const insert = db.prepare(
      "INSERT OR IGNORE INTO point_package_members (package_id, task_id) VALUES (?, ?)",
    );
    for (const taskId of unique) insert.run(input.packageId, taskId);
    db.prepare(
      `UPDATE point_packages SET scope_change_note = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(`${input.reason.trim()} (${input.actorId})`, input.packageId);
    settlePackage(db, input.packageId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
