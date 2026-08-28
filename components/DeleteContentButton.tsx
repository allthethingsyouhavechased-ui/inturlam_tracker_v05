"use client";

import { useTransition } from "react";
import { deleteContentItemAction } from "@/lib/actions/content";

export default function DeleteContentButton({ contentId }: { contentId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          confirm(
            "Bu içerik/proje silinsin mi? Altındaki tüm görevler ve yorumlar da silinir.",
          )
        ) {
          startTransition(() => deleteContentItemAction(contentId));
        }
      }}
      className="text-xs font-medium text-danger hover:text-rose-500 disabled:opacity-50"
    >
      {pending ? "Siliniyor…" : "İçeriği sil"}
    </button>
  );
}
