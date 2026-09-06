"use client";

import { useId, useState, useTransition } from "react";
import { getActionErrorMessage } from "@/lib/errorMessage";
import { setContentStatusAction } from "@/lib/actions/content";
import {
  CONTENT_STATUS_BADGE,
  CONTENT_STATUS_LABEL,
  CONTENT_STATUSES,
} from "@/lib/constants";
import type { ContentStatus } from "@/lib/types";

export default function ContentStatusSelect({
  contentId,
  status,
}: {
  contentId: string;
  status: ContentStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const noteId = useId();
  return (
    <div>
    <select
      aria-label="İçerik durumu"
      aria-describedby={noteId}
      value={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as ContentStatus;
        setError(null);
        startTransition(async () => {
          try { await setContentStatusAction(contentId, next); }
          catch (error) { setError(getActionErrorMessage(error)); }
        });
      }}
      className={`cursor-pointer rounded-full border-0 px-2.5 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-brand-500 ${CONTENT_STATUS_BADGE[status]} ${pending ? "opacity-50" : ""}`}
    >
      {CONTENT_STATUSES.map((s) => (
        <option key={s} value={s}>
          {CONTENT_STATUS_LABEL[s]}
        </option>
      ))}
    </select>
    <p id={noteId} className={`mt-1 max-w-sm text-xs ${status === "IptalEdildi" ? "text-warning" : "text-muted"}`}>{status === "IptalEdildi" ? "İçerik iptal edildi. Alt görevlerin durumu ve puanları değişmedi; açık görevleri ayrıca gözden geçirin." : "İptal seçimi alt görevleri ve puanlarını değiştirmez."}</p>
    {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
