import Link from "next/link";
import PersonAvatar from "@/components/PersonAvatar";
import Icon from "@/components/ui/Icon";
import { TASK_DIFFICULTY_LABEL } from "@/lib/constants";
import { formatDateShort } from "@/lib/date";
import { formatRevisionDuration, isRevisionOverTarget } from "@/lib/taskMetadata";
import type { TaskWithContext } from "@/lib/types";

function TaskRow({ task, detail }: { task: TaskWithContext; detail: string }) {
  return (
    <Link href={`/tasks/${task.id}`} className="group flex min-w-0 items-center gap-3 px-4 py-3 hover:bg-surface-hover sm:px-5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border-subtle bg-surface-subtle text-muted group-hover:border-brand-300 group-hover:text-brand-600">
        <Icon name="tasks" className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-300">{task.title}</span>
        <span className="mt-0.5 block truncate text-[10px] text-muted">{task.brand_name} · {detail}</span>
      </span>
      {task.assignee_name && <PersonAvatar name={task.assignee_name} avatarPath={task.assignee_avatar_path} size="xs" />}
    </Link>
  );
}

function FocusColumn({
  eyebrow,
  title,
  count,
  empty,
  children,
}: {
  eyebrow: string;
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-hidden border-b border-border-subtle last:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0">
      <div className="flex items-end justify-between gap-3 border-b border-border-subtle px-4 py-3.5 sm:px-5">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.09em] text-brand-600 dark:text-brand-300">{eyebrow}</p>
          <h2 className="mt-1 text-sm font-semibold text-foreground">{title}</h2>
        </div>
        <span className="text-xl font-semibold tabular-nums text-foreground">{count}</span>
      </div>
      {count > 0 ? <div className="divide-y divide-border-subtle">{children}</div> : <p className="px-5 py-8 text-center text-xs text-muted">{empty}</p>}
    </section>
  );
}

export default function HomeFocusPanel({
  personalDeadlines,
  revisionTasks,
  reviewTasks,
}: {
  personalDeadlines: TaskWithContext[];
  revisionTasks: TaskWithContext[];
  reviewTasks: TaskWithContext[];
}) {
  return (
    <section aria-label="Günün çalışma odağı" className="grid overflow-hidden rounded-xl border border-border-default bg-surface xl:grid-cols-3">
      <FocusColumn eyebrow="KİŞİSEL ODAK" title="Yakın teslimlerim" count={personalDeadlines.length} empty="Yaklaşan kişisel teslimin yok.">
        {personalDeadlines.slice(0, 4).map((task) => <TaskRow key={task.id} task={task} detail={task.due_date ? `Teslim ${formatDateShort(task.due_date)}` : "Tarih bekliyor"} />)}
      </FocusColumn>
      <FocusColumn eyebrow="REVİZE MASASI" title="Aktif revizeler" count={revisionTasks.length} empty="Aktif revize turu yok.">
        {revisionTasks.slice(0, 4).map((task) => <TaskRow key={task.id} task={task} detail={`R${task.revision_count} · ${formatRevisionDuration(task.active_revision_elapsed_minutes)}${isRevisionOverTarget(task.active_revision_elapsed_minutes, task.active_revision_target_minutes) ? " · süre aşıldı" : ""}`} />)}
      </FocusColumn>
      <FocusColumn eyebrow="KARAR BEKLİYOR" title="İncelemedeki işler" count={reviewTasks.length} empty="İncelemede bekleyen iş yok.">
        {reviewTasks.slice(0, 4).map((task) => <TaskRow key={task.id} task={task} detail={`${task.difficulty ? TASK_DIFFICULTY_LABEL[task.difficulty] : "Zorluk belirsiz"} · ${task.weight_points} puan`} />)}
      </FocusColumn>
    </section>
  );
}
