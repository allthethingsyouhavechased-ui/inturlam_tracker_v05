"use client";

import { useTransition } from "react";
import { restoreArchivedTaskAction, setTaskArchivedAction } from "@/lib/actions/tasks";

// Görev arşivi bir SİLME değil, "panodan çek" düğmesi — bu yüzden arşivlerken
// onay sorulmuyor (ArchiveContentButton'ın aksine): geri alma tek tık ve görev
// hiçbir listeden kalıcı olarak kaybolmuyor.
export default function ArchiveTaskButton({
  taskId,
  archived,
}: {
  taskId: string;
  archived: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => archived
        ? restoreArchivedTaskAction(taskId)
        : setTaskArchivedAction(taskId, true))}
      className="ui-press min-h-11 rounded-xl px-3 text-xs font-medium text-zinc-600 hover:bg-black/5 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-white/10"
    >
      {pending ? "…" : archived ? "Yeniden aç" : "Arşivle"}
    </button>
  );
}
