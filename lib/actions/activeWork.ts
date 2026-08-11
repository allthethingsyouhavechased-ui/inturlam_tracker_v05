"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/identity";
import { setPersonActiveBrand } from "@/lib/repositories/activeWork";

export async function setActiveBrandAction(brandId: string | null) {
  const person = await requireSession();

  setPersonActiveBrand(person.id, brandId || null);
  revalidatePath("/team");
}
