"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  approveClientRequestAction,
  rejectClientRequestAction,
  updateClientRequestReviewAction,
} from "@/lib/actions/clientRequests";
import { TASK_PRIORITIES, TASK_PRIORITY_LABEL } from "@/lib/constants";
import { DEPARTMENTS, type DepartmentId } from "@/lib/departments";
import type { Person, TaskPriority } from "@/lib/types";
import Button, { buttonClass } from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Icon from "@/components/ui/Icon";

function ReviewButtons({ assigneeName }: { assigneeName: string | null }) {
  const { pending } = useFormStatus();
  const disabled = pending || !assigneeName;
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
      <button
        type="submit"
        formAction={updateClientRequestReviewAction}
        disabled={disabled}
        className={buttonClass({ variant: "secondary", className: "w-full" })}
      >
        {pending ? "Kaydediliyor…" : "İncelemeye al"}
      </button>
      <button
        type="submit"
        formAction={approveClientRequestAction}
        disabled={disabled}
        className={buttonClass({ className: "w-full" })}
      >
        {pending
          ? "Onaylanıyor…"
          : assigneeName
            ? "Onayla ve görevi ata"
            : "Önce görev sahibi seç"}
      </button>
    </div>
  );
}

function RejectButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" className="w-full" disabled={pending}>
      {pending ? "Reddediliyor…" : "Talebi reddet"}
    </Button>
  );
}

export default function RequestReviewForm({
  requestId,
  department: initialDepartment,
  assigneeId,
  priority,
  dueDate,
  people,
}: {
  requestId: string;
  department: string;
  assigneeId: string | null;
  priority: TaskPriority;
  dueDate: string | null;
  people: Person[];
}) {
  const initialPerson = people.find((person) => person.id === assigneeId);
  const initialPersonDepartment = initialPerson?.department;
  const firstDepartment = DEPARTMENTS.some(({ id }) => id === initialPersonDepartment)
    ? (initialPersonDepartment as DepartmentId)
    : DEPARTMENTS.some(({ id }) => id === initialDepartment)
      ? (initialDepartment as DepartmentId)
      : "video";
  const assignablePeople = people.filter((person) =>
    DEPARTMENTS.some(({ id }) => id === person.department),
  );
  const [department, setDepartment] = useState<DepartmentId>(firstDepartment);
  const [selectedAssignee, setSelectedAssignee] = useState(
    assignablePeople.some((person) => person.id === assigneeId)
      ? assigneeId ?? ""
      : "",
  );
  const selectedAssigneeName =
    assignablePeople.find((person) => person.id === selectedAssignee)?.name ?? null;

  return (
    <div className="space-y-4">
      <form className="space-y-4">
        <input type="hidden" name="requestId" value={requestId} />
        <label className="grid gap-2 rounded-xl border border-brand-200 bg-brand-50/60 p-3 text-xs font-semibold text-foreground dark:border-brand-900 dark:bg-brand-950/25">
          <span className="flex items-center justify-between gap-3">
            Görev sahibi
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-900 dark:text-brand-200">
              Zorunlu
            </span>
          </span>
          <Select
            name="assigneeId"
            required
            value={selectedAssignee}
            aria-describedby="request-assignee-help"
            onChange={(event) => {
              const personId = event.target.value;
              setSelectedAssignee(personId);
              const person = assignablePeople.find((candidate) => candidate.id === personId);
              if (person && DEPARTMENTS.some(({ id }) => id === person.department)) {
                setDepartment(person.department as DepartmentId);
              }
            }}
          >
            <option value="">Atanacak kişiyi seç</option>
            {DEPARTMENTS.map((group) => {
              const members = assignablePeople.filter((person) => person.department === group.id);
              return members.length > 0 ? (
                <optgroup key={group.id} label={group.label}>
                  {members.map((person) => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </Select>
          <span id="request-assignee-help" className="font-normal leading-4 text-muted">
            Kişiyi seçtiğinde hedef departman otomatik eşleşir.
          </span>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-secondary">
          Hedef departman
          <Select
            name="department"
            value={department}
            onChange={(event) => {
              setDepartment(event.target.value as DepartmentId);
              setSelectedAssignee("");
            }}
          >
            {DEPARTMENTS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </Select>
        </label>
        <div
          role="status"
          className={`flex items-start gap-2 rounded-[10px] border px-3 py-2.5 text-xs leading-5 ${
            selectedAssigneeName
              ? "border-brand-200 bg-brand-50/70 text-brand-800 dark:border-brand-900 dark:bg-brand-950/30 dark:text-brand-200"
              : "border-border-default bg-surface-subtle text-muted"
          }`}
        >
          <Icon name="user" className="mt-0.5 size-4" />
          <span>
            {selectedAssigneeName
              ? `Talep onaylandığında oluşan görev doğrudan ${selectedAssigneeName} kişisine atanacak.`
              : "Göreve dönüşmeden önce sorumlu kişiyi seç."}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <label className="grid gap-1.5 text-xs font-medium text-secondary">
            Öncelik
            <Select name="priority" defaultValue={priority}>
              {TASK_PRIORITIES.map((option) => (
                <option key={option} value={option}>{TASK_PRIORITY_LABEL[option]}</option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-secondary">
            Hedef teslim
            <Input name="dueDate" type="date" defaultValue={dueDate ?? ""} />
          </label>
        </div>
        <ReviewButtons assigneeName={selectedAssigneeName} />
      </form>

      <details className="border-t border-border-subtle pt-4">
        <summary className="cursor-pointer text-xs font-semibold text-danger hover:underline">
          Uygun değilse reddet
        </summary>
        <form action={rejectClientRequestAction} className="mt-3 space-y-3">
          <input type="hidden" name="requestId" value={requestId} />
          <label className="grid gap-1.5 text-xs font-medium text-secondary">
            Ret gerekçesi
            <Textarea
              name="reason"
              rows={3}
              required
              maxLength={2000}
              placeholder="Eksik bilgi veya talebin neden işleme alınmadığını yaz…"
            />
          </label>
          <RejectButton />
        </form>
      </details>
    </div>
  );
}
