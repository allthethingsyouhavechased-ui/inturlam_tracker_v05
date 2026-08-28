"use client";

import { useRef, useState, useTransition } from "react";
import {
  addTemplateItemAction,
  createTemplateAction,
  deleteTemplateAction,
  deleteTemplateItemAction,
  renameTemplateAction,
} from "@/lib/actions/templates";
import {
  CONTENT_TYPE_LABEL,
  CONTENT_TYPES,
  TASK_DIFFICULTIES,
  TASK_DIFFICULTY_BADGE,
  TASK_DIFFICULTY_LABEL,
  TASK_PRIORITIES,
  TASK_PRIORITY_BADGE,
  TASK_PRIORITY_LABEL,
} from "@/lib/constants";
import { getActionErrorMessage } from "@/lib/errorMessage";
import type { TaskTemplateWithItems } from "@/lib/types";
import SubmitButton from "./SubmitButton";

// `ClusterManager` ile aynı desen: satır içi düzenleme + alta ekleme formu.
// Fark, şablonların iki seviyeli olması (şablon → görev satırları).

const inputClass =
  "min-h-10 rounded-lg border border-border-default bg-background px-3 py-2 text-sm outline-none focus:border-brand-500";

// "Teslimden N gün önce/sonra" ofsetini insan diline çevirir.
function offsetLabel(days: number | null): string {
  if (days === null) return "teslim günü";
  if (days === 0) return "teslim günü";
  return days < 0 ? `${Math.abs(days)} gün önce` : `${days} gün sonra`;
}

function TemplateCard({
  template,
  onError,
  canDeleteTemplates,
}: {
  template: TaskTemplateWithItems;
  onError: (message: string | null) => void;
  canDeleteTemplates: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const itemFormRef = useRef<HTMLFormElement>(null);

  return (
    <article className="rounded-xl border border-border-default bg-surface p-4">
      {editing ? (
        <form
          action={async (fd) => {
            onError(null);
            try {
              await renameTemplateAction(fd);
              setEditing(false);
            } catch (e) {
              onError(getActionErrorMessage(e));
            }
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="id" value={template.id} />
          <input
            name="name"
            required
            autoFocus
            defaultValue={template.name}
            className={`${inputClass} flex-1`}
          />
          <select
            name="contentType"
            defaultValue={template.content_type ?? ""}
            className={inputClass}
            aria-label="İçerik türü"
          >
            <option value="">Her tür</option>
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {CONTENT_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <SubmitButton>Kaydet</SubmitButton>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Vazgeç
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <h3 className="flex-1 truncate text-sm font-semibold">{template.name}</h3>
          {/* Rozetin kendi zemini (bg-black/5) kartı biraz koyulaştırdığı için
              burada zinc-500 kontrast eşiğinin altında kalıyor — bir ton koyu. */}
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-zinc-600 dark:bg-white/10 dark:text-zinc-400">
            {template.content_type
              ? CONTENT_TYPE_LABEL[template.content_type]
              : "Her tür"}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400 dark:hover:text-brand-400"
          >
            Düzenle
          </button>
          {canDeleteTemplates && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                onError(null);
                if (!confirm(`“${template.name}” şablonu silinsin mi?`)) return;
                startTransition(async () => {
                  try {
                    await deleteTemplateAction(template.id);
                  } catch (e) {
                    onError(getActionErrorMessage(e));
                  }
                });
              }}
              className="text-xs font-medium text-muted hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-50"
            >
              {pending ? "…" : "Sil"}
            </button>
          )}
        </div>
      )}

      <ol className="mt-3 space-y-1">
        {template.items.map((item, i) => (
          <li
            key={item.id}
            className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
          >
            <span className="w-5 shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{i + 1}.</span>
            <span className="flex-1 truncate">{item.title}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${TASK_PRIORITY_BADGE[item.priority]}`}
            >
              {TASK_PRIORITY_LABEL[item.priority]}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TASK_DIFFICULTY_BADGE[item.difficulty]}`}>
              {TASK_DIFFICULTY_LABEL[item.difficulty]}
            </span>
            <span className="w-28 shrink-0 text-right text-xs text-zinc-500 dark:text-zinc-400">
              {offsetLabel(item.due_offset_days)}
            </span>
            {canDeleteTemplates && (
              <form action={deleteTemplateItemAction.bind(null, item.id)}>
                <button
                  type="submit"
                  className="touch-target text-xs font-medium text-muted hover:text-rose-600 dark:hover:text-rose-400"
                  aria-label={`${item.title} satırını sil`}
                >
                  ×
                </button>
              </form>
            )}
          </li>
        ))}
        {template.items.length === 0 && (
          <li className="px-2 py-1 text-sm text-zinc-500 dark:text-zinc-400">Henüz görev satırı yok.</li>
        )}
      </ol>

      <form
        ref={itemFormRef}
        action={async (fd) => {
          onError(null);
          try {
            await addTemplateItemAction(fd);
            itemFormRef.current?.reset();
          } catch (e) {
            onError(getActionErrorMessage(e));
          }
        }}
        className="mt-3 flex flex-wrap items-end gap-2 border-t border-border-subtle pt-3"
      >
        <input type="hidden" name="templateId" value={template.id} />
        <label className="grid flex-1 gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Görev
          <input
            name="title"
            required
            placeholder="Örn. Kapak görseli"
            className={inputClass}
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Zorluk
          <select name="difficulty" defaultValue="Orta" className={inputClass}>
            {TASK_DIFFICULTIES.map((value) => (
              <option key={value} value={value}>{TASK_DIFFICULTY_LABEL[value]}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Öncelik
          <select name="priority" defaultValue="Normal" className={inputClass}>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {TASK_PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Gün kayması
          <input
            name="dueOffsetDays"
            type="number"
            placeholder="0"
            title="İçeriğin teslim tarihine göre: -3 = üç gün önce, 0 = teslim günü. Boş bırakılırsa teslim günü kullanılır."
            className={`${inputClass} w-28`}
          />
        </label>
        <SubmitButton>Satır ekle</SubmitButton>
      </form>
    </article>
  );
}

export default function TemplateManager({
  templates,
  canDeleteTemplates,
}: {
  templates: TaskTemplateWithItems[];
  canDeleteTemplates: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const newFormRef = useRef<HTMLFormElement>(null);

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      {templates.map((t) => (
        <TemplateCard
          key={t.id}
          template={t}
          onError={setError}
          canDeleteTemplates={canDeleteTemplates}
        />
      ))}

      <form
        ref={newFormRef}
        action={async (fd) => {
          setError(null);
          try {
            await createTemplateAction(fd);
            newFormRef.current?.reset();
          } catch (e) {
            setError(getActionErrorMessage(e));
          }
        }}
        className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-border-default bg-surface-subtle p-4"
      >
        <label className="grid flex-1 gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Yeni şablon adı
          <input
            name="name"
            required
            placeholder="Örn. Kurumsal kimlik akışı"
            className={inputClass}
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          İçerik türü
          <select name="contentType" defaultValue="" className={inputClass}>
            <option value="">Her tür</option>
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {CONTENT_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <SubmitButton>Şablon ekle</SubmitButton>
      </form>
    </div>
  );
}
