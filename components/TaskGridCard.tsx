import Link from "next/link";
import CommentIcon from "@/components/CommentIcon";
import PersonAvatar from "@/components/PersonAvatar";
import TaskStatusSelect from "@/components/TaskStatusSelect";
import TaskTargetDateEdit from "@/components/TaskTargetDateEdit";
import Icon from "@/components/ui/Icon";
import {
  CONTENT_TYPE_LABEL,
  TASK_PRIORITY_BADGE,
  TASK_PRIORITY_LABEL,
} from "@/lib/constants";
import { formatDateShort, isOverdue } from "@/lib/date";
import type { TaskCardBadge, TaskPriority, TaskWithContext } from "@/lib/types";

export type { TaskCardBadge };

const PRIORITY_LINE: Record<TaskPriority, string> = {
  Dusuk: "border-l-sky-400",
  Normal: "border-l-border-strong",
  Yuksek: "border-l-amber-500",
  Acil: "border-l-rose-500",
};

export default function TaskGridCard({
  task,
  showStatus = true,
  badges,
}: {
  task: TaskWithContext;
  showStatus?: boolean;
  badges?: TaskCardBadge[];
}) {
  return (
    <article
      className={`flex h-[210px] min-w-0 flex-col rounded-xl border border-border-default border-l-[3px] bg-surface p-3 transition-colors hover:border-border-strong hover:bg-surface-hover ${PRIORITY_LINE[task.priority]}`}
    >
      <div className="flex min-h-8 min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 pt-0.5">
          <span className="shrink-0 rounded-md bg-brand-50 px-1.5 py-1 text-[9px] font-bold tracking-[0.055em] text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
            {CONTENT_TYPE_LABEL[task.content_type].toLocaleUpperCase("tr-TR")}
          </span>
          <span
            title={task.content_title}
            className="min-w-0 truncate text-[10px] font-medium text-muted"
          >
            {task.content_title}
          </span>
        </div>
        {showStatus && <TaskStatusSelect taskId={task.id} status={task.status} />}
      </div>

      <div className="mt-1 flex min-h-5 flex-wrap gap-1">
        {(task.archived_at !== null || (badges && badges.length > 0)) && (
          <>
          {task.archived_at !== null && (
            <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-secondary">
              ARŞİV
            </span>
          )}
          {badges?.map((badge) => (
            <span
              key={badge.label}
              className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${badge.className}`}
            >
              {badge.label.toLocaleUpperCase("tr-TR")}
            </span>
          ))}
          </>
        )}
      </div>

      <div className="mt-1 min-h-[52px] min-w-0">
        <Link
          href={`/tasks/${task.id}`}
          className="line-clamp-2 text-[13px] font-semibold leading-[1.35] text-foreground hover:text-brand-600 dark:hover:text-brand-300"
        >
          {task.title}
        </Link>
        <p className="mt-1 truncate text-[11px] text-muted">{task.brand_name}</p>
      </div>

      <div className="mt-auto border-t border-border-subtle pt-2.5">
        <div className="grid min-h-8 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <span className="inline-flex min-w-0 items-center gap-1 text-[11px]">
          {task.due_date ? (
            <span
              className={`inline-flex min-h-8 items-center gap-1 whitespace-nowrap tabular-nums ${
                isOverdue(task.due_date)
                  ? "font-semibold text-danger dark:text-rose-400"
                  : "text-muted"
              }`}
            >
              <Icon name="calendar" className="size-3.5" />
              {formatDateShort(task.due_date)}
            </span>
          ) : (
            <span className="inline-flex min-h-8 items-center gap-1 whitespace-nowrap text-faint">
              <Icon name="calendar" className="size-3.5" />
              Tarih yok
            </span>
          )}
          </span>
          <span className="flex min-w-0 justify-end">
            {task.personal_target_date !== undefined &&
            (task.status === "Yayinlandi" ? (
              task.personal_target_date && (
                <span className="inline-flex min-h-8 items-center gap-1 whitespace-nowrap text-[11px] font-medium text-brand-600 dark:text-brand-300">
                  <Icon name="clock" className="size-3.5" />
                  Hedef {formatDateShort(task.personal_target_date)}
                </span>
              )
            ) : (
              <TaskTargetDateEdit taskId={task.id} targetDate={task.personal_target_date} />
            ))}
          </span>
        </div>
        <div className="mt-1 flex min-h-6 items-center justify-end gap-1.5">
          {task.comment_count > 0 && (
            <Link
              href={`/tasks/${task.id}`}
              title={task.last_comment_body ?? `${task.comment_count} yorum`}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-muted hover:bg-surface-hover hover:text-foreground"
            >
              <CommentIcon />
              {task.comment_count}
            </Link>
          )}
          {task.priority !== "Normal" && (
            <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${TASK_PRIORITY_BADGE[task.priority]}`}>
              {TASK_PRIORITY_LABEL[task.priority].toLocaleUpperCase("tr-TR")}
            </span>
          )}
          {task.assignee_name && (
            <PersonAvatar name={task.assignee_name} avatarPath={task.assignee_avatar_path} size="xs" />
          )}
        </div>
      </div>
    </article>
  );
}
