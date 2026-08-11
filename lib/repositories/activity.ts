import { getDb, plainList } from "@/lib/db/client";
import type { ActivityEntry, ActivityEntityType } from "@/lib/types";

export interface NewActivity {
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: ActivityEntityType;
  entityId: string | null;
  brandId: string | null;
  summary: string;
}

// Append-only kayıt. Loglama asla ana mutasyonu bozmamalı — çağıran taraf
// (lib/activity.ts) bu çağrıyı try/catch ile sarıyor.
export function insertActivity(a: NewActivity): void {
  getDb()
    .prepare(
      `INSERT INTO activity_log
         (id, actor_id, actor_name, action, entity_type, entity_id, brand_id, summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      crypto.randomUUID(),
      a.actorId,
      a.actorName,
      a.action,
      a.entityType,
      a.entityId,
      a.brandId,
      a.summary,
    );
}

// actor_name activity_log'da anlık görüntü olarak duruyor (FK yok, kişi
// silinse bile kayıt okunabilir kalsın diye) ama avatar_path'i de aynı
// şekilde donduracak bir sebep yok: kişiler bu uygulamada kalıcı silinmiyor
// (yalnızca pasife alınıyor), bu yüzden avatar OKUMA ANINDA people'dan
// LEFT JOIN'lenir — güncel fotoğraf gösterir, kişi sonradan değiştirse bile.
const WITH_ACTOR_AVATAR_SELECT = `
  SELECT a.*, p.avatar_path AS actor_avatar_path
  FROM activity_log a
  LEFT JOIN people p ON p.id = a.actor_id
`;

export function listRecentActivity(limit = 100): ActivityEntry[] {
  return plainList<ActivityEntry>(
    getDb()
      .prepare(
        `${WITH_ACTOR_AVATAR_SELECT} ORDER BY a.created_at DESC, a.rowid DESC LIMIT ?`,
      )
      .all(limit),
  );
}

// Bir görevin zaman çizelgesi — göreve ait olaylar + o görevin altındaki
// yorumlar (yorumlar entity_type='task', entity_id=görev id ile loglanıyor).
export function listActivityForEntity(
  entityType: ActivityEntityType,
  entityId: string,
  limit = 50,
): ActivityEntry[] {
  return plainList<ActivityEntry>(
    getDb()
      .prepare(
        `${WITH_ACTOR_AVATAR_SELECT}
         WHERE a.entity_type = ? AND a.entity_id = ?
         ORDER BY a.created_at DESC, a.rowid DESC LIMIT ?`,
      )
      .all(entityType, entityId, limit),
  );
}

export function listActivityForBrand(
  brandId: string,
  limit = 30,
): ActivityEntry[] {
  return plainList<ActivityEntry>(
    getDb()
      .prepare(
        `${WITH_ACTOR_AVATAR_SELECT}
         WHERE a.brand_id = ?
         ORDER BY a.created_at DESC, a.rowid DESC LIMIT ?`,
      )
      .all(brandId, limit),
  );
}

// Bir kişinin KENDİ yaptığı işlemler (actor_id) — `/activity` ve marka
// sayfaları herkesin/bir markanın akışını gösteriyor, profil sayfası bunu tek
// kişiye daraltıyor. `activity_log` zaten her satırda `actor_id` tutuyor,
// yalnızca bu sorgu eksikti (2026-08-11 tasarım revizyonu — profil sayfası
// artık gerçek bir kişisel dashboard).
export function listActivityForActor(actorId: string, limit = 20): ActivityEntry[] {
  return plainList<ActivityEntry>(
    getDb()
      .prepare(
        `${WITH_ACTOR_AVATAR_SELECT}
         WHERE a.actor_id = ?
         ORDER BY a.created_at DESC, a.rowid DESC LIMIT ?`,
      )
      .all(actorId, limit),
  );
}
