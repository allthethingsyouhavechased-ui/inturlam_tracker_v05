"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/identity";
import { QuickCreateValidationError, type QuickCreateResult } from "@/lib/quickCreate";
import { quickCreateTask } from "@/lib/repositories/quickCreate";

export async function quickCreateTaskAction(formData: FormData): Promise<QuickCreateResult> {
  const actor = await requireSession();
  try {
    const result = quickCreateTask(actor.id, formData);
    revalidatePath("/", "layout");
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof QuickCreateValidationError) return { ok: false, fieldErrors: error.fieldErrors, formError: error.message };
    return { ok: false, fieldErrors: {}, formError: "Görev kaydedilemedi. Bilgileriniz korundu; tekrar deneyebilirsiniz." };
  }
}
