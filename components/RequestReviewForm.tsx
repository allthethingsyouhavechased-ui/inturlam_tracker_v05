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

function ReviewButtons() {
  const { pending } = useFormStatus();
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
      <button
        type="submit"
        formAction={updateClientRequestReviewAction}
        disabled={pending}
        className={buttonClass({ variant: "secondary", className: "w-full" })}
      >
        {pending ? "Kaydediliyor…" : "İncelemeye al"}
      </button>
      <button
        type="submit"
        formAction={approveClientRequestAction}
        disabled={pending}
        className={buttonClass({ className: "w-full" })}
      >
        {pending ? "Onaylanıyor…" : "Onayla ve göreve dönüştür"}
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
  const firstDepartment = DEPARTMENTS.some(({ id }) => id === initialDepartment)
    ? (initialDepartment as DepartmentId)
    : "video";
  const [department, setDepartment] = useState<DepartmentId>(firstDepartment);
  const [selectedAssignee, setSelectedAssignee] = useState(
    people.some((person) => person.id === assigneeId && person.department === firstDepartment)
      ? assigneeId ?? ""
      : "",
  );
  const eligiblePeople = people.filter((person) => person.department === department);

  return (
    <div className="space-y-4">
      <form className="space-y-4">
        <input type="hidden" name="requestId" value={requestId} />
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
        <label className="grid gap-1.5 text-xs font-medium text-secondary">
          Görev sahibi
          <Select
            name="assigneeId"
            required
            value={selectedAssignee}
            onChange={(event) => setSelectedAssignee(event.target.value)}
          >
            <option value="">Kişi seç</option>
            {eligiblePeople.map((person) => (
              <option key={person.id} value={person.id}>{person.name}</option>
            ))}
          </Select>
          {eligiblePeople.length === 0 && (
            <span className="font-normal text-danger">Bu departmanda aktif ekip üyesi yok.</span>
          )}
        </label>
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
        <ReviewButtons />
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
