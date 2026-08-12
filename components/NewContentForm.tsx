"use client";

import { useRef, useState } from "react";
import { createContentItemAction } from "@/lib/actions/content";
import { CONTENT_TYPES, CONTENT_TYPE_LABEL } from "@/lib/constants";
import { getActionErrorMessage } from "@/lib/errorMessage";
import type { ContentType, Person, TaskTemplate } from "@/lib/types";
import SubmitButton from "./SubmitButton";

const inputClass =
  "w-full min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] focus:border-brand-500 dark:border-white/15 dark:bg-zinc-900";

export default function NewContentForm({
  brandId,
  people,
  templates,
  defaultAssigneeId,
}: {
  brandId: string;
  people: Person[];
  templates: TaskTemplate[];
  defaultAssigneeId?: string | null;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<ContentType>("Reel");
  const [templateId, setTemplateId] = useState("");
  const compatibleTemplates = templates.filter(
    (template) => template.content_type === null || template.content_type === type,
  );

  return (
    <form
      ref={ref}
      action={async (fd) => {
        setError(null);
        try {
          await createContentItemAction(fd);
          ref.current?.reset();
          setType("Reel");
          setTemplateId("");
        } catch (e) {
          setError(getActionErrorMessage(e));
        }
      }}
      className="grid gap-3 sm:grid-cols-2 sm:items-end xl:grid-cols-[minmax(14rem,1.4fr)_repeat(4,minmax(8rem,1fr))_auto]"
    >
      <input type="hidden" name="brandId" value={brandId} />
      <label className="grid gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Başlık
        <input
          name="title"
          required
          placeholder="Örn. Ağustos Reels paketi"
          className={inputClass}
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Tür
        <select
          name="type"
          className={inputClass}
          value={type}
          onChange={(e) => {
            const nextType = e.target.value as ContentType;
            setType(nextType);
            const selected = templates.find((template) => template.id === templateId);
            if (selected?.content_type && selected.content_type !== nextType) setTemplateId("");
          }}
        >
          {CONTENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {CONTENT_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Görev şablonu
        <select
          name="templateId"
          value={templateId}
          onChange={(event) => setTemplateId(event.target.value)}
          className={inputClass}
        >
          <option value="">Şablonsuz oluştur</option>
          {compatibleTemplates.map((template) => (
            <option key={template.id} value={template.id}>{template.name}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Atanan
        <select
          name="assigneeId"
          className={inputClass}
          defaultValue={defaultAssigneeId ?? ""}
        >
          <option value="">— kimse —</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Hedef tarih
        <input
          type="date"
          name="targetDate"
          required={Boolean(templateId)}
          aria-describedby={templateId ? "template-target-date-help" : undefined}
          className={inputClass}
        />
        {templateId && <span id="template-target-date-help" className="text-[10px] text-amber-700 dark:text-amber-300">Şablon için zorunlu</span>}
      </label>
      <SubmitButton>Ekle</SubmitButton>
      {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400 sm:col-span-2 xl:col-span-6">{error}</p>}
    </form>
  );
}
