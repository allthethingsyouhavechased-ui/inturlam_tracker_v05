import type { Person } from "@/lib/types";

// Rol atama yetkisi şimdilik tek kişide. İsim değişebilir; sabit kişi id'si
// kimlik doğrulaması için görünen addan daha güvenilir ve kararlıdır.
export const ROLE_ADMIN_PERSON_ID = "yunus";

type RoleActor = Pick<Person, "id"> | null | undefined;

export function canManageRoles(person: RoleActor): boolean {
  return person?.id === ROLE_ADMIN_PERSON_ID;
}

export function assertCanManageRoles(person: RoleActor): void {
  if (!canManageRoles(person)) {
    throw new Error("Yönetici yetkisini yalnızca Yunus Emre değiştirebilir.");
  }
}

export function assertCanDeactivatePerson(personId: string): void {
  if (personId === ROLE_ADMIN_PERSON_ID) {
    throw new Error("Sistem yöneticisi pasife alınamaz.");
  }
}

// Görev SİLME yalnız yöneticilerde. Panodaki diğer işlemler (durum, öncelik,
// atama, düzenleme) ortak iş havuzu mantığıyla herkese açık kalıyor — silme
// ayrıldı çünkü tek geri alınamayan işlem o: giden görevle birlikte yorumları,
// ekleri ve durum geçmişi de gidiyor.
type TaskActor = Pick<Person, "is_manager"> | null | undefined;

export function canDeleteTasks(person: TaskActor): boolean {
  return person?.is_manager === 1;
}

export function assertCanDeleteTasks(person: TaskActor): void {
  if (!canDeleteTasks(person)) {
    throw new Error("Görev silme yetkisi yalnızca yöneticilerde.");
  }
}
