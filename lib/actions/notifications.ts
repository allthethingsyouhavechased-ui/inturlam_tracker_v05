"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/identity";
import {
  markAllNotificationsReadForPerson,
  markNotificationRead,
} from "@/lib/repositories/notifications";

export async function markNotificationReadAction(id: string) {
  const person = await requireSession();
  markNotificationRead(id, person.id);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction() {
  const person = await requireSession();
  markAllNotificationsReadForPerson(person.id);
  revalidatePath("/", "layout");
}
