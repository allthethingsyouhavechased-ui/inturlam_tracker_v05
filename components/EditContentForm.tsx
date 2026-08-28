"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Input";
import { updateContentItemAction } from "@/lib/actions/content";
import { CONTENT_TYPES, CONTENT_TYPE_LABEL } from "@/lib/constants";
import { getActionErrorMessage } from "@/lib/errorMessage";
import type { ContentItem, Person } from "@/lib/types";
import SubmitButton from "./SubmitButton";

const inputClass = controlClass();

export default function EditContentForm({
  content,
  people,
}: {
  content: Pick<ContentItem, "id" | "title" | "type" | "target_date" | "assignee_id">;
  people: Person[];
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={buttonClass({ variant: "ghost", className: "px-2 text-xs" })}
      >
        Düzenle
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        setError(null);
        try {
          await updateContentItemAction(fd);
          setEditing(false);
        } catch (e) {
          setError(getActionErrorMessage(e));
        }
      }}
      className="grid w-full gap-3 rounded-xl border border-border-default bg-surface p-4 sm:grid-cols-[1fr_auto_auto_auto]"
    >
      <input type="hidden" name="contentId" value={content.id} />
      <label className="grid gap-1 text-xs font-medium text-secondary">
        Başlık
        <input
          name="title"
          required
          defaultValue={content.title}
          className={inputClass}
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-secondary">
        Tür
        <select name="type" defaultValue={content.type} className={inputClass}>
          {CONTENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {CONTENT_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-secondary">
        Atanan
        <select
          name="assigneeId"
          defaultValue={content.assignee_id ?? ""}
          className={inputClass}
        >
          <option value="">— kimse —</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-secondary">
        Hedef tarih
        <input
          type="date"
          name="targetDate"
          defaultValue={content.target_date ?? ""}
          className={inputClass}
        />
      </label>
      <div className="flex items-center gap-3 sm:col-span-4">
        <SubmitButton>Kaydet</SubmitButton>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className={buttonClass({ variant: "ghost" })}
        >
          Vazgeç
        </button>
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      </div>
    </form>
  );
}
