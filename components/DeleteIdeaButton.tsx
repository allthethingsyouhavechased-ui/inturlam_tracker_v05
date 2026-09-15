"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteIdeaAction } from "@/lib/actions/ideas";
import { runUndoable } from "@/lib/undoQueue";

/**
 * Fikri siler. Silme ile ARŞİVLEME ayrı işlemler: arşiv fikri bankadan çeker
 * ama kaydı korur, silme kaydı kaldırır (başlık ve kimin sildiği
 * `idea_deletions`'ta kalır). Gerçek silme, geri alma süresi dolana kadar
 * sunucuya HİÇ gitmez — lib/undoQueue.ts.
 */
export default function DeleteIdeaButton({
  ideaId,
  title,
}: {
  ideaId: string;
  title: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          runUndoable({
            message: `“${title}” fikri silindi`,
            commit: () =>
              startTransition(async () => {
                const result = await deleteIdeaAction(ideaId);
                if (!result.ok) { setError(result.error); return; }
                router.refresh();
              }),
            rollback: () => {},
          });
        }}
        className="min-h-9 rounded-[9px] border border-border-default bg-surface px-3 text-xs font-semibold text-danger hover:bg-surface-hover disabled:opacity-50"
      >
        {pending ? "Siliniyor…" : "Fikri sil"}
      </button>
      {error && <span role="alert" className="max-w-56 text-right text-[10px] text-danger">{error}</span>}
    </span>
  );
}
