"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/identity";
import { saveMonthlyPointTargets, type PointTargetUpdate } from "@/lib/repositories/monthlyPointTargets";

export async function saveMonthlyPointTargetsAction(month: string, updates: PointTargetUpdate[], note: string) {
  const actor = await requireManager();
  try {
    const changed = saveMonthlyPointTargets(actor.person.id, month, updates, note);
    revalidatePath("/", "layout");
    return { ok: true as const, message: changed ? `${changed} kişinin aylık hedefi kaydedildi.` : "Hedefler zaten güncel." };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error && !error.message.startsWith("SQLITE") ? error.message : "Hedefler kaydedilemedi. Tekrar deneyin." };
  }
}
