"use client";

import { useTransition } from "react";
import { deleteClientRequestAction } from "@/lib/actions/clientRequests";
import { getActionErrorMessage } from "@/lib/errorMessage";

export default function DeleteClientRequestButton({
  requestId,
  converted,
}: {
  requestId: string;
  converted: boolean;
}) {
  const [pending, startTransition] = useTransition();
  if (converted) return null;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Bu talep kalıcı olarak silinsin mi? Brief, yorumlar ve görsel ekleri geri alınamaz.")) return;
        startTransition(async () => {
          try {
            await deleteClientRequestAction(requestId);
          } catch (error) {
            alert(getActionErrorMessage(error));
          }
        });
      }}
      className="text-xs font-semibold text-danger hover:text-rose-500 disabled:opacity-50"
    >
      {pending ? "Siliniyor…" : "Talebi sil"}
    </button>
  );
}
