"use client";

import { useRef, useState } from "react";
import { createContentItemAction } from "@/lib/actions/content";
import { CONTENT_TYPES, CONTENT_TYPE_LABEL } from "@/lib/constants";
import { getActionErrorMessage } from "@/lib/errorMessage";
import type { ContentType, Person } from "@/lib/types";
import SubmitButton from "./SubmitButton";

const inputClass =
  "w-full min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] focus:border-brand-500 dark:border-white/15 dark:bg-zinc-900";

export default function NewContentForm({
  brandId,
  people,
  defaultAssigneeId,
}: {
  brandId: string;
  people: Person[];
  defaultAssigneeId?: string | null;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<ContentType>("Reel");

  return (
    <form
      ref={ref}
      action={async (fd) => {
        setError(null);
        try {
          await createContentItemAction(fd);
          ref.current?.reset();
          setType("Reel");
        } catch (e) {
          setError(getActionErrorMessage(e));
        }
      }}
      className="grid gap-3 sm:grid-cols-[minmax(16rem,1fr)_auto_auto_auto_auto] sm:items-end"
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
          onChange={(e) => setType(e.target.value as ContentType)}
        >
          {CONTENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {CONTENT_TYPE_LABEL[t]}
            </option>
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
        <input type="date" name="targetDate" className={inputClass} />
      </label>
      <SubmitButton>Ekle</SubmitButton>
      {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400 sm:col-span-5">{error}</p>}
    </form>
  );
}
