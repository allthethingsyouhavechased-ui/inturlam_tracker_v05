import { getDb, plainList, plainOne } from "@/lib/db/client";
import { extraPointItem } from "@/lib/points/catalog";
import { istanbulDay, istanbulMonth } from "@/lib/points/period";

export interface PointLedgerRow {
  id: string;
  entry_key: string | null;
  person_id: string;
  period: string;
  source_type: "package" | "extra" | "manager" | "correction";
  source_id: string | null;
  item_key: string | null;
  amount_units: number;
  reason: string | null;
  reverses_id: string | null;
  created_at: string;
}

export interface PersonPointSummary {
  person_id: string;
  person_name: string;
  period: string;
  /** Temel işlerden (paket) kazanılan. */
  base_units: number;
  /** Ek puan havuzundan kazanılan. */
  extra_units: number;
  /** Yönetici serbest puanı. */
  manager_units: number;
  /** Düzeltme/ters kayıtlar (negatif olabilir). */
  correction_units: number;
  total_units: number;
}

export function listLedgerForPerson(personId: string, period: string): PointLedgerRow[] {
  return plainList<PointLedgerRow>(
    getDb()
      .prepare(
        `SELECT * FROM point_ledger WHERE person_id = ? AND period = ?
          ORDER BY created_at DESC, id`,
      )
      .all(personId, period),
  );
}

const SUMMARY_SELECT = `
  SELECT p.id AS person_id, p.name AS person_name, ? AS period,
         COALESCE(SUM(CASE WHEN l.source_type = 'package' THEN l.amount_units ELSE 0 END), 0) AS base_units,
         COALESCE(SUM(CASE WHEN l.source_type = 'extra' THEN l.amount_units ELSE 0 END), 0) AS extra_units,
         COALESCE(SUM(CASE WHEN l.source_type = 'manager' THEN l.amount_units ELSE 0 END), 0) AS manager_units,
         COALESCE(SUM(CASE WHEN l.source_type = 'correction' THEN l.amount_units ELSE 0 END), 0) AS correction_units,
         COALESCE(SUM(l.amount_units), 0) AS total_units
    FROM people p
    LEFT JOIN point_ledger l ON l.person_id = p.id AND l.period = ?
`;

/** Kişi bazında ay özeti. Aktif olmayan kişiler de sayılır (geçmiş hak ediş). */
export function listPersonPointSummaries(period: string): PersonPointSummary[] {
  return plainList<PersonPointSummary>(
    getDb()
      .prepare(`${SUMMARY_SELECT} GROUP BY p.id ORDER BY p.name`)
      .all(period, period),
  );
}

export function getPersonPointSummary(personId: string, period: string): PersonPointSummary | undefined {
  return plainOne<PersonPointSummary>(
    getDb()
      .prepare(`${SUMMARY_SELECT} WHERE p.id = ? GROUP BY p.id`)
      .get(period, period, personId),
  );
}

/**
 * Ek puan havuzundan bir kalem yazar.
 *
 * Tekilleştirme kaleme göre değişir ve `entry_key`'in UNIQUE olmasıyla
 * sağlanır: çift tıklama, tekrar deneme ve eşzamanlı istek ikinci kaydı
 * yazamaz. Çekim kişi + YEREL TAKVİM GÜNÜ başına tekildir — aynı gün farklı
 * markalarla çoğaltılamaz ve gün bölünmez.
 */
export function recordExtraPoint(input: {
  personId: string;
  itemKey: string;
  /** Tekilleştirme çapası: gün (çekim), olay id'si, fikir id'si, teslim id'si. */
  referenceId: string;
  occurredAt?: string;
  reason: string | null;
  createdBy: string;
}): { id: string; units: number; period: string } {
  const item = extraPointItem(input.itemKey);
  if (!item) throw new Error("Tanımsız ek puan kalemi.");
  if (item.units === null) {
    throw new Error("Yönetici serbest puanı bu yoldan yazılmaz; recordManagerPoint kullanılmalı.");
  }
  const stamp = input.occurredAt ?? new Date().toISOString();
  const period = istanbulMonth(stamp);
  const anchor = item.uniqueness === "person-day" ? istanbulDay(stamp) : input.referenceId;
  if (!anchor) throw new Error("Ek puan için tekilleştirme çapası zorunlu.");
  const entryKey = `extra:${input.itemKey}:${input.personId}:${anchor}`;

  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    if (db.prepare("SELECT 1 FROM point_ledger WHERE entry_key = ?").get(entryKey)) {
      throw new Error("Bu ek puan zaten yazılmış.");
    }
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO point_ledger
         (id, entry_key, person_id, period, source_type, source_id, item_key, amount_units, reason, created_by)
       VALUES (?, ?, ?, ?, 'extra', ?, ?, ?, ?, ?)`,
    ).run(id, entryKey, input.personId, period, input.referenceId, input.itemKey, item.units, input.reason, input.createdBy);
    db.exec("COMMIT");
    return { id, units: item.units, period };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Yönetici serbest puanı. Katalogdaki TEK serbest tutarlı kalem budur ve
 * açıklaması ZORUNLUDUR — diğer kalemler sabit fiyat × doğrulanmış adet.
 */
export function recordManagerPoint(input: {
  personId: string;
  period: string;
  amountUnits: number;
  reason: string;
  createdBy: string;
}): string {
  if (!input.reason.trim()) throw new Error("Yönetici puanı için açıklama zorunlu.");
  if (!Number.isInteger(input.amountUnits) || input.amountUnits === 0) {
    throw new Error("Yönetici puanı sıfırdan farklı, tam sayı iç birim olmalı.");
  }
  const id = crypto.randomUUID();
  getDb()
    .prepare(
      `INSERT INTO point_ledger
         (id, person_id, period, source_type, item_key, amount_units, reason, created_by)
       VALUES (?, ?, ?, 'manager', 'manager_review', ?, ?, ?)`,
    )
    .run(id, input.personId, input.period, input.amountUnits, input.reason.trim(), input.createdBy);
  return id;
}

/**
 * Yanlış bir kaydı SİLMEZ; gerekçeli ters kayıt yazar. Geçmişi yok etmek,
 * raporla ekranın birbirini tutmamasına yol açar.
 */
export function reversePointEntry(input: {
  entryId: string;
  reason: string;
  createdBy: string;
}): string {
  if (!input.reason.trim()) throw new Error("Ters kayıt için gerekçe zorunlu.");
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const entry = db.prepare("SELECT * FROM point_ledger WHERE id = ?").get(input.entryId) as PointLedgerRow | undefined;
    if (!entry) throw new Error("Puan kaydı bulunamadı.");
    if (db.prepare("SELECT 1 FROM point_ledger WHERE reverses_id = ?").get(input.entryId)) {
      throw new Error("Bu kayıt zaten terslenmiş.");
    }
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO point_ledger
         (id, person_id, period, source_type, source_id, item_key, amount_units, reason, reverses_id, created_by)
       VALUES (?, ?, ?, 'correction', ?, ?, ?, ?, ?, ?)`,
    ).run(
      id, entry.person_id, entry.period, entry.source_id, entry.item_key,
      -entry.amount_units, input.reason.trim(), entry.id, input.createdBy,
    );
    db.exec("COMMIT");
    return id;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
