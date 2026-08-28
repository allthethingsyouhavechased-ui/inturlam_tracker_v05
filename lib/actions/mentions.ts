"use server";

import { requireSession } from "@/lib/identity";
import { listActivePeople } from "@/lib/repositories/people";

export interface MentionablePerson {
  id: string;
  name: string;
}

// Yorum kutusundaki `@` önerileri. Liste yorum yazılan HER sayfada prop olarak
// taşınmıyor: kutuya ilk `@` yazılana kadar hiç okunmuyor.
export async function listMentionablePeopleAction(): Promise<MentionablePerson[]> {
  await requireSession();
  return listActivePeople().map((person) => ({ id: person.id, name: person.name }));
}
