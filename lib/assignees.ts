import { getPerson } from "@/lib/repositories/people";

export function activeAssigneeId(value: string | null | undefined): string | null {
  const personId = value?.trim() || null;
  if (!personId) return null;

  const person = getPerson(personId);
  if (!person || person.active !== 1) {
    throw new Error("Atanacak aktif ekip üyesi bulunamadı.");
  }
  return person.id;
}
