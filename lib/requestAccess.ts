import type { Person } from "@/lib/types";

// Ürün kararı (2026-08): talep değerlendirme alanı rol veya departmana göre
// açılmaz. Yalnızca aşağıdaki beş sabit hesap kuyruğu görebilir ve yönetebilir.
export const CLIENT_REQUEST_REVIEWER_IDS = [
  "yunus",
  "erhan",
  "sila",
  "defne",
  "cansu",
] as const;

const REVIEWER_IDS = new Set<string>(CLIENT_REQUEST_REVIEWER_IDS);

export function canReviewClientRequests(
  person: (Pick<Person, "id"> & Partial<Pick<Person, "department">>) | null | undefined,
): boolean {
  return Boolean(person && REVIEWER_IDS.has(person.id));
}
