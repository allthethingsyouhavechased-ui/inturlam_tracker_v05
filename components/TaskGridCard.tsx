import Link from "next/link";
import CommentIcon from "@/components/CommentIcon";
import PersonAvatar from "@/components/PersonAvatar";
import TaskQuickRevisionDialog from "@/components/TaskQuickRevisionDialog";
import TaskStatusSelect from "@/components/TaskStatusSelect";
import TaskTargetDateEdit from "@/components/TaskTargetDateEdit";
import Icon from "@/components/ui/Icon";
import { brandAccentStyle } from "@/lib/brandAccent";
import {
  CONTENT_TYPE_LABEL,
  TASK_DIFFICULTY_BADGE,
  TASK_DIFFICULTY_LABEL,
  TASK_PRIORITY_BADGE,
  TASK_PRIORITY_LABEL,
  taskWeightBadgeClass,
} from "@/lib/constants";
import { formatDateShort, isOverdue } from "@/lib/date";
import { formatRevisionDuration, isRevisionOverTarget } from "@/lib/taskMetadata";
import type { TaskCardBadge, TaskWithContext } from "@/lib/types";

export type { TaskCardBadge };

const metaBadgeClass =
  "inline-flex min-h-5 items-center rounded-md px-2 py-0.5 text-[9px] font-semibold tracking-wide";

export default function TaskGridCard({
  task,
  showStatus = true,
  badges,
  onOpenComments,
  onContextMenu,
}: {
  task: TaskWithContext;
  showStatus?: boolean;
  badges?: TaskCardBadge[];
  onOpenComments?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
}) {
  return (
    <article
      onContextMenu={onContextMenu}
      data-brand-accent
      style={brandAccentStyle(task.brand_accent_hue)}
      className="relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-border-default bg-surface p-3 transition-colors hover:border-border-strong hover:bg-surface-hover"
    >
      <span aria-hidden="true" className="brand-accent-fill pointer-events-none absolute inset-y-0 left-0 w-[3px]" />
      <header className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">
          <Link
            href={`/tasks/${task.id}`}
            className="line-clamp-2 text-sm font-semibold leading-[1.35] text-foreground hover:text-brand-600 dark:hover:text-brand-300"
          >
            {task.title}
          </Link>
          <p className="mt-0.5 truncate text-[11px] font-medium text-secondary">
            {task.brand_name}
          </p>
          <p title={task.content_title} className="mt-0.5 truncate text-[10px] text-muted">
            {task.content_title}
          </p>
        </div>
        {showStatus && (
          <span className="shrink-0">
            <TaskStatusSelect taskId={task.id} status={task.status} />
          </span>
        )}
      </header>

      <div role="group" aria-label="Görev ayrıntıları" className="mt-2.5 flex min-w-0 flex-wrap items-center gap-1.5">
        <span className={`${metaBadgeClass} bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300`}>
          {CONTENT_TYPE_LABEL[task.content_type].toLocaleUpperCase("tr-TR")}
        </span>
        {task.archived_at !== null && (
          <span className={`${metaBadgeClass} bg-surface-muted text-secondary`}>ARŞİV</span>
        )}
        {badges?.map((badge) => (
          <span key={badge.label} className={`${metaBadgeClass} ${badge.className}`}>
            {badge.label.toLocaleUpperCase("tr-TR")}
          </span>
        ))}
        {task.difficulty && (
          <span className={`${metaBadgeClass} ${TASK_DIFFICULTY_BADGE[task.difficulty]}`}>
            {TASK_DIFFICULTY_LABEL[task.difficulty].toLocaleUpperCase("tr-TR")}
          </span>
        )}
        {task.revision_count > 0 && (
          <span
            title={task.active_revision_id ? "Aktif revize turu" : "Tamamlanan revize turları"}
            className={`${metaBadgeClass} ${
              isRevisionOverTarget(task.active_revision_elapsed_minutes, task.active_revision_target_minutes)
                ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
                : task.active_revision_id
                  ? "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200"
                  : "bg-surface-muted text-secondary"
            }`}
          >
            R{task.revision_count}
            {task.active_revision_id && task.active_revision_elapsed_minutes !== null
              ? ` · ${formatRevisionDuration(task.active_revision_elapsed_minutes)}`
              : ""}
          </span>
        )}
      </div>

      <footer className="mt-2.5 border-t border-border-subtle pt-2">
        <div
          role="group"
          aria-label="Görev zamanlaması ve sorumlusu"
          className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1"
        >
          <div className="min-w-0">
            {task.due_date ? (
              <span
                className={`inline-flex min-h-7 items-center gap-1 whitespace-nowrap text-[11px] tabular-nums ${
                  isOverdue(task.due_date) ? "font-semibold text-danger" : "text-muted"
                }`}
              >
                <Icon name="calendar" className="size-3.5" />
                {formatDateShort(task.due_date)}
              </span>
            ) : (
              <span className="inline-flex min-h-7 items-center gap-1 whitespace-nowrap text-[11px] text-faint">
                <Icon name="calendar" className="size-3.5" />
                Tarih yok
              </span>
            )}
          </div>
          <span className={`${metaBadgeClass} justify-self-end ${TASK_PRIORITY_BADGE[task.priority]}`}>
            {TASK_PRIORITY_LABEL[task.priority].toLocaleUpperCase("tr-TR")}
          </span>
          {/* Hedef tarih + revize/yorum düğmeleri AYNI hücrede: düğmeler kendi
              satırına inince kart bir satır uzuyor ve düğmenin sağında koca bir
              boşluk kalıyordu. Puan ve avatar bu satırda, karşılarında. */}
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {task.personal_target_date !== undefined &&
              (task.status === "Yayinlandi" ? (
                task.personal_target_date && (
                  <span className="inline-flex min-h-7 items-center gap-1 whitespace-nowrap text-[11px] font-medium text-brand-600 dark:text-brand-300">
                    <Icon name="clock" className="size-3.5" />
                    Hedef {formatDateShort(task.personal_target_date)}
                  </span>
                )
              ) : (
                <TaskTargetDateEdit taskId={task.id} targetDate={task.personal_target_date} compact />
              ))}
            {task.status === "Incelemede" && task.pending_delivery_id && task.pending_delivery_version && (
              <TaskQuickRevisionDialog
                taskTitle={task.title}
                deliveryId={task.pending_delivery_id}
                deliveryVersion={task.pending_delivery_version}
              />
            )}
            {task.comment_count > 0 &&
              (onOpenComments ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onOpenComments();
                  }}
                  title={task.last_comment_body ?? `${task.comment_count} yorum`}
                  aria-label={`${task.comment_count} yorumu aç`}
                  className="ui-press inline-flex min-h-7 items-center gap-1 rounded-md px-1.5 text-[10px] font-medium text-muted hover:bg-surface-hover hover:text-foreground"
                >
                  <CommentIcon />
                  {task.comment_count}
                </button>
              ) : (
                <Link
                  href={`/tasks/${task.id}`}
                  title={task.last_comment_body ?? `${task.comment_count} yorum`}
                  className="inline-flex min-h-7 items-center gap-1 rounded-md px-1.5 text-[10px] font-medium text-muted hover:bg-surface-hover hover:text-foreground"
                >
                  <CommentIcon />
                  {task.comment_count}
                </Link>
              ))}
          </div>
          <span className="flex items-center justify-self-end gap-1.5">
              {/* `shrink-0` + `leading-none`: flex çocuğu olarak daralıp ovale
                  dönmesin ve rakam satır yüksekliğinden bağımsız olarak tam
                  ortada dursun. Boyut her kartta sabit (28px); rengi puana
                  göre değişir. */}
              <span
                aria-label={`${task.weight_points} puan`}
                title={`Görev ağırlığı: ${task.weight_points} puan`}
                className={`grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold leading-none tabular-nums ${taskWeightBadgeClass(task.weight_points)}`}
              >
                {task.weight_points}
              </span>
              {task.assignee_name && (
                <PersonAvatar name={task.assignee_name} avatarPath={task.assignee_avatar_path} size="xs" />
              )}
          </span>
        </div>
      </footer>
    </article>
  );
}
