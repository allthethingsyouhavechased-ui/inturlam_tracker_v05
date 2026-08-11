"use server";

import { revalidatePath } from "next/cache";
import { recordActivity } from "@/lib/activity";
import { ensureCluster } from "@/lib/clusters";
import { requireSession } from "@/lib/identity";
import {
  countBrandsInCluster,
  deleteCluster,
  getCluster,
  renameCluster,
} from "@/lib/repositories/clusters";

export async function createClusterAction(formData: FormData) {
  await requireSession();
  const label = String(formData.get("label") ?? "").trim();
  if (!label) throw new Error("Kategori adı zorunlu.");
  await ensureCluster(label);
  revalidatePath("/", "layout");
}

export async function renameClusterAction(formData: FormData) {
  await requireSession();
  const id = String(formData.get("clusterId") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  if (!label) throw new Error("Kategori adı zorunlu.");
  const current = getCluster(id);
  if (!current) throw new Error("Kategori bulunamadı.");
  if (current.label === label) return;

  renameCluster(id, label);
  await recordActivity({
    action: "cluster.rename",
    entityType: "cluster",
    entityId: id,
    summary: `“${current.label}” kategorisini “${label}” olarak adlandırdı`,
  });
  revalidatePath("/", "layout");
}

export async function deleteClusterAction(clusterId: string) {
  await requireSession();
  const current = getCluster(clusterId);
  if (!current) throw new Error("Kategori bulunamadı.");

  // Kategori ile marka arasında FK yok (bkz. schema.sql) — bu yüzden "boş mu"
  // kontrolü burada yapılmalı, yoksa markalar gruplanamaz hale gelirdi.
  const used = countBrandsInCluster(clusterId);
  if (used > 0) {
    throw new Error(
      `Bu kategoride ${used} marka var. Önce onları başka bir kategoriye taşı.`,
    );
  }

  deleteCluster(clusterId);
  await recordActivity({
    action: "cluster.delete",
    entityType: "cluster",
    entityId: null,
    summary: `“${current.label}” kategorisini sildi`,
  });
  revalidatePath("/", "layout");
}
