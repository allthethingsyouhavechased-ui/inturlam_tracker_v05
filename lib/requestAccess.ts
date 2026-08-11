import type { Person } from "@/lib/types";

// Ürün kararı (2026-08): müşteri talebi değerlendirme yetkisi genel yönetici
// rolünden daha dardır. Tanımlı sorumlular ile Sosyal Medya departmanı talep
// kuyruğunu yönetebilir; rapor görebilen her yönetici talep onaylayamaz.
export const CLIENT_REQUEST_REVIEWER_IDS = ["yunus", "sila", "erhan"] as const;
export const CLIENT_REQUEST_REVIEWER_DEPARTMENTS = ["social"] as const;

const REVIEWER_IDS = new Set<string>(CLIENT_REQUEST_REVIEWER_IDS);
const REVIEWER_DEPARTMENTS = new Set<string>(CLIENT_REQUEST_REVIEWER_DEPARTMENTS);

export function canReviewClientRequests(
  person: (Pick<Person, "id"> & Partial<Pick<Person, "department">>) | null | undefined,
): boolean {
  return Boolean(
    person
      && (REVIEWER_IDS.has(person.id)
        || (person.department && REVIEWER_DEPARTMENTS.has(person.department))),
  );
}
