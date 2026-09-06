import { CONTENT_TYPES, TASK_DIFFICULTIES, TASK_PRIORITIES } from "@/lib/constants";
import { NEW_CONTENT_VALUE } from "@/lib/quickAdd";

export function quickCreateDefaults(assigneeId: string | null = null, dueDate = "") {
  return { contentId: NEW_CONTENT_VALUE, newContentTitle: "", taskType: CONTENT_TYPES[0],
    taskTitle: "", priority: TASK_PRIORITIES[1], difficulty: TASK_DIFFICULTIES[1],
    weightPoints: "", assigneeId: assigneeId ?? "", dueDate };
}

export type QuickCreateField = "brandId" | "contentItemId" | "newContentTitle" | "title" | "contentType" | "priority" | "difficulty" | "weightPoints" | "assigneeId" | "dueDate";
export type QuickCreateFieldErrors = Partial<Record<QuickCreateField, string>>;
export type QuickCreateResult =
  | { ok: true; taskId: string; contentItemId: string }
  | { ok: false; fieldErrors: QuickCreateFieldErrors; formError: string };

export class QuickCreateValidationError extends Error {
  fieldErrors: QuickCreateFieldErrors;
  constructor(fieldErrors: QuickCreateFieldErrors, message = "İşaretli alanları kontrol edin.") {
    super(message);
    this.fieldErrors = fieldErrors;
  }
}
