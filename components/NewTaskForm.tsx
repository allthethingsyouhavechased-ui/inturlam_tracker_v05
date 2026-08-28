"use client";

import { useRef, useState } from "react";
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
}: {
  contentItemId: string;
  defaultContentType: ContentType;
  canSetWeight?: boolean;
  people: Person[];
  defaultAssigneeId?: string | null;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<TaskDifficulty>("Orta");
  return (
    <form
      ref={ref}
      action={async (fd) => {
        setError(null);
        try {
          await createTaskAction(fd);
          ref.current?.reset();
        } catch (e) {
          setError(getActionErrorMessage(e));
        }
      }}
      className={`grid gap-3 sm:grid-cols-2 sm:items-end ${
        canSetWeight
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
      {error && <p role="alert" className={`text-xs text-danger sm:col-span-2 ${canSetWeight ? "xl:col-span-8" : "xl:col-span-7"}`}>{error}</p>}
    </form>
  );
}
