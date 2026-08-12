"use client";

import { useState, useTransition } from "react";
import { applyTemplateAction } from "@/lib/actions/templates";
import { getActionErrorMessage } from "@/lib/errorMessage";
import type { TaskTemplate } from "@/lib/types";

// İçerik zaten açılmışken sonradan şablon uygulamak için. İçerik oluşturulurken
// şablon seçme yolu NewContentForm'da; bu, "sonradan aklıma geldi" hali.
const selectClass =
  "rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-500 dark:border-white/15 dark:bg-zinc-900";

export default function ApplyTemplateForm({
  contentItemId,
  templates,
  defaultAssigneeId,
  hasTargetDate,
}: {
  contentItemId: string;
  templates: TaskTemplate[];
  defaultAssigneeId: string | null;
  hasTargetDate: boolean;
}) {
  const [templateId, setTemplateId] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (templates.length === 0) return null;

  const selected = templates.find((t) => t.id === templateId);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select
        aria-label="Şablon"
        disabled={!hasTargetDate}
        value={templateId}
        onChange={(e) => {
          setTemplateId(e.target.value);
          setMessage(null);
          setError(null);
        }}
        className={selectClass}
      >
        <option value="">Şablondan görev ekle…</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        disabled={!hasTargetDate || !templateId || pending}
        onClick={() => {
          if (!selected) return;
          setError(null);
          setMessage(null);
          startTransition(async () => {
            try {
              const count = await applyTemplateAction(
                selected.id,
                contentItemId,
                defaultAssigneeId,
              );
              setMessage(`${count} görev eklendi.`);
              setTemplateId("");
            } catch (e) {
              setError(getActionErrorMessage(e));
            }
          });
        }}
        className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
      >
        {pending ? "Ekleniyor…" : "Uygula"}
      </button>

      {message && <span className="text-xs text-emerald-600">{message}</span>}
      {error && <span role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</span>}
      {!hasTargetDate && (
        <span className="basis-full text-right text-[11px] text-amber-700 dark:text-amber-300">
          Şablon uygulamak için önce içerik hedef tarihini belirle.
        </span>
      )}
    </div>
  );
}
