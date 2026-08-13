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
