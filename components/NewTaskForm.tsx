"use client";

import { useState } from "react";
import { controlClass } from "@/components/ui/Input";
import { createTaskAction } from "@/lib/actions/tasks";
import {
  CONTENT_TYPES,
  CONTENT_TYPE_LABEL,
  TASK_DIFFICULTIES,
  TASK_DIFFICULTY_LABEL,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
} from "@/lib/constants";
import { getActionErrorMessage } from "@/lib/errorMessage";
import { DIFFICULTY_DEFAULT_WEIGHT } from "@/lib/progress";
import type { ContentType, Person, TaskDifficulty } from "@/lib/types";
import SubmitButton from "./SubmitButton";

const inputClass = controlClass();

export default function NewTaskForm({
  contentItemId,
  defaultContentType,
  canSetWeight = false,
  people,
  defaultAssigneeId,
  compact = false,
}: {
  contentItemId: string;
  defaultContentType: ContentType;
  canSetWeight?: boolean;
  people: Person[];
  defaultAssigneeId?: string | null;
  compact?: boolean;
}) {
  const [formVersion, setFormVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [difficulty, setDifficulty] = useState<TaskDifficulty>("Orta");
  return (
    <form
      key={formVersion}
      action={async (fd) => {
        setError(null);
        setCreated(false);
        try {
          await createTaskAction(fd);
          setDifficulty("Orta");
          setFormVersion(version => version + 1);
          setCreated(true);
        } catch (e) {
          setError(getActionErrorMessage(e));
        }
      }}
      className={`grid gap-3 sm:grid-cols-2 sm:items-end ${
        compact ? "" : canSetWeight
          ? "xl:grid-cols-[minmax(14rem,1fr)_auto_auto_auto_auto_auto_auto_auto]"
          : "xl:grid-cols-[minmax(14rem,1fr)_auto_auto_auto_auto_auto_auto]"
      }`}
    >
      <input type="hidden" name="contentItemId" value={contentItemId} />
      <label className="grid gap-1 text-xs font-medium text-secondary">
        Görev
        <input
          name="title"
          required
          placeholder="Örn. Çekim, Kurgu, Onay…"
          className={inputClass}
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-secondary">
        Görev türü
        <select name="contentType" required className={inputClass} defaultValue={defaultContentType}>
          {CONTENT_TYPES.map((type) => (
            <option key={type} value={type}>{CONTENT_TYPE_LABEL[type]}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-secondary">
        Zorluk
        <select name="difficulty" required className={inputClass} value={difficulty} onChange={(event) => setDifficulty(event.target.value as TaskDifficulty)}>
          {TASK_DIFFICULTIES.map((difficulty) => (
            <option key={difficulty} value={difficulty}>
              {TASK_DIFFICULTY_LABEL[difficulty]}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-secondary">
        Öncelik
        <select name="priority" className={inputClass} defaultValue="Normal">
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {TASK_PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-secondary">
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
      <label className="grid gap-1 text-xs font-medium text-secondary">
        Teslim
        <input type="date" name="dueDate" required className={inputClass} />
      </label>
      {canSetWeight && (
        <label className="grid gap-1 text-xs font-medium text-secondary">
          Puan
          <input
            type="number"
            name="weightPoints"
            min={1}
            max={100}
            step={1}
            placeholder={String(DIFFICULTY_DEFAULT_WEIGHT[difficulty])}
            aria-label={`Puan; boşsa ${DIFFICULTY_DEFAULT_WEIGHT[difficulty]}`}
            className={inputClass}
          />
        </label>
      )}
      <SubmitButton>Ekle</SubmitButton>
      {created && <p role="status" className="col-span-full text-xs text-brand-600 dark:text-brand-300">Görev eklendi. Pencereyi kapatarak panoda görebilirsin.</p>}
      {error && <p role="alert" className="col-span-full text-xs text-danger">{error}</p>}
    </form>
  );
}
