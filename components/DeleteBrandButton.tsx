"use client";

import { useTransition } from "react";
import { deleteBrandAction } from "@/lib/actions/brands";
import { getActionErrorMessage } from "@/lib/errorMessage";

export default function DeleteBrandButton({ brandId }: { brandId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          confirm(
            "Bu marka kalıcı olarak silinsin mi? Altındaki tüm içerik/proje, görev ve yorumlar da silinir. Geri alınamaz.",
          )
        ) {
          startTransition(async () => {
            try {
              await deleteBrandAction(brandId);
            } catch (e) {
              alert(getActionErrorMessage(e));
            }
          });
        }
      }}
      className="text-xs font-medium text-danger hover:text-rose-500 disabled:opacity-50"
    >
      {pending ? "Siliniyor…" : "Kalıcı sil"}
    </button>
  );
}
