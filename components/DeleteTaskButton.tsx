"use client";

import { useTransition } from "react";
import { deleteTaskAction } from "@/lib/actions/tasks";

export default function DeleteTaskButton({ taskId }: { taskId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("Bu görev silinsin mi? Yorumları da silinir.")) {
          startTransition(() => deleteTaskAction(taskId));
        }
      }}
      className="text-xs font-medium text-danger hover:text-rose-500 disabled:opacity-50"
    >
      {pending ? "Siliniyor…" : "Görevi sil"}
    </button>
  );
}
