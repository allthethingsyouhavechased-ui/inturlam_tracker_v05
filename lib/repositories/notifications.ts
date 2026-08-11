import { getDb, plainList, plainOne } from "@/lib/db/client";
import type { Notification } from "@/lib/types";

export interface NewNotification {
  recipientId: string;
  recipientName: string | null;
  actorId: string | null;
  actorName: string | null;
  taskId: string | null;
  brandId: string | null;
  summary: string;
}

export function createNotification(input: NewNotification): string {
  const id = crypto.randomUUID();
  getDb()
    .prepare(
      `INSERT INTO notifications
         (id, recipient_id, recipient_name, actor_id, actor_name, task_id, brand_id, summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.recipientId,
      input.recipientName,
      input.actorId,
      input.actorName,
      input.taskId,
      input.brandId,
      input.summary,
    );
  return id;
}

export function listNotificationsForPerson(
  personId: string,
  limit = 20,
): Notification[] {
  return plainList<Notification>(
    getDb()
      .prepare(
        `SELECT * FROM notifications
         WHERE recipient_id = ?
         ORDER BY created_at DESC, rowid DESC LIMIT ?`,
      )
      .all(personId, limit),
  );
}

export function countUnreadForPerson(personId: string): number {
  const { n } = plainOne<{ n: number }>(
    getDb()
      .prepare(
        `SELECT COUNT(*) AS n FROM notifications WHERE recipient_id = ? AND read = 0`,
      )
      .get(personId),
  )!;
  return n;
}

export function markNotificationRead(id: string, personId: string): boolean {
  const result = getDb()
    .prepare(
      `UPDATE notifications SET read = 1
       WHERE id = ? AND recipient_id = ? AND read = 0`,
    )
    .run(id, personId);
  return Number(result.changes) > 0;
}

export function markAllNotificationsReadForPerson(personId: string): void {
  getDb()
    .prepare(`UPDATE notifications SET read = 1 WHERE recipient_id = ? AND read = 0`)
    .run(personId);
}

// Bir kişinin okunmamış bildirimlerinin bağlı olduğu görev id'leri — pano
// kartlarında "🔔 Güncellendi" rozetini hangi görevlere basacağını belirlemek
// için (bkz. app/panom/page.tsx). @mention ve görev güncelleme bildirimleri
// ayrım yapılmadan birlikte sayılır: ikisi de "bu görevde senin için yeni bir
// şey var" anlamına geldiği için rozet açısından fark etmiyor.
export function listUnreadTaskIdsForPerson(personId: string): Set<string> {
  const rows = plainList<{ task_id: string }>(
    getDb()
      .prepare(
        `SELECT DISTINCT task_id FROM notifications
         WHERE recipient_id = ? AND read = 0 AND task_id IS NOT NULL`,
      )
      .all(personId),
  );
  return new Set(rows.map((r) => r.task_id));
}

// Görev detay sayfası açıldığında o görevle ilgili bildirimleri okundu
// yapar — panodaki "🔔 Güncellendi" rozeti tekrar görülünce kaybolsun diye
// (bkz. sweepArchivablePublishedTasks ile aynı "render'dan önce best-effort
// yan etki" deseni, app/tasks/[taskId]/page.tsx).
export function markTaskNotificationsReadForPerson(taskId: string, personId: string): void {
  getDb()
    .prepare(
      `UPDATE notifications SET read = 1
       WHERE task_id = ? AND recipient_id = ? AND read = 0`,
    )
    .run(taskId, personId);
}
