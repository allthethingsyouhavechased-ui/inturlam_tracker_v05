"use server";

import { revalidatePath } from "next/cache";
import { requireGuestSession } from "@/lib/identity";
import {
  markAllNotificationsReadForPerson,
  markNotificationRead,
} from "@/lib/repositories/notifications";

export async function markGuestNotificationReadAction(id: string) {
  const actor = await requireGuestSession();
  markNotificationRead(id, actor.account_id);
  revalidatePath("/guest", "layout");
}

export async function markAllGuestNotificationsReadAction() {
  const actor = await requireGuestSession();
  markAllNotificationsReadForPerson(actor.account_id);
  revalidatePath("/guest", "layout");
}
