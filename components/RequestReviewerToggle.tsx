"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setRequestReviewerAction } from "@/lib/actions/people";

/**
 * Talep değerlendirme yetkisi. Yöneticiler bu yetkiye zaten sahip (tabloda
 * olmasalar da) — düğme yalnızca yönetici OLMAYAN kişiler için anlamlı.
 */
export default function RequestReviewerToggle({
  personId,
  isReviewer,
}: {
  personId: string;
  isReviewer: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await setRequestReviewerAction(personId, !isReviewer);
            if (!result.ok) { setError(result.error); return; }
            router.refresh();
          });
        }}
        className={`touch-target whitespace-nowrap text-xs font-medium disabled:opacity-50 ${
          isReviewer
            ? "text-amber-700 hover:text-rose-600 dark:text-amber-400 dark:hover:text-rose-400"
            : "text-brand-600 hover:text-brand-500 dark:text-brand-400"
        }`}
      >
        {pending ? "…" : isReviewer ? "Talep yetkisini al" : "Talep yetkisi ver"}
      </button>
      {error && <span role="alert" className="text-[10px] text-danger">{error}</span>}
    </span>
  );
}
