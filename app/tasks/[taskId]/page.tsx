import Link from "next/link";
import { notFound } from "next/navigation";
import ActivityFeed from "@/components/ActivityFeed";
import ArchiveTaskButton from "@/components/ArchiveTaskButton";
import AssigneeSelect from "@/components/AssigneeSelect";
import AutoRefresh from "@/components/AutoRefresh";
import CommentForm from "@/components/CommentForm";
import CommentItem from "@/components/CommentItem";
import DeleteTaskButton from "@/components/DeleteTaskButton";
import SubmitButton from "@/components/SubmitButton";
import TaskNotesAttachments from "@/components/TaskNotesAttachments";
import TaskPrioritySelect from "@/components/TaskPrioritySelect";
import TaskRepeatSelect from "@/components/TaskRepeatSelect";
import TaskStatusSelect from "@/components/TaskStatusSelect";
import { CONTENT_TYPE_LABEL } from "@/lib/constants";
import { updateTaskDetailsAction } from "@/lib/actions/tasks";
import { getCurrentPerson } from "@/lib/identity";
import { listActivityForEntity } from "@/lib/repositories/activity";
import { listCommentsByTask } from "@/lib/repositories/comments";
import { listActivePeople } from "@/lib/repositories/people";
import { listAttachmentsByTask } from "@/lib/repositories/taskAttachments";
import { getTask } from "@/lib/repositories/tasks";
import { markTaskNotificationsReadForPerson } from "@/lib/repositories/notifications";
import { ARCHIVE_AFTER_DAYS, daysUntilArchive } from "@/lib/taskArchive";

export const dynamic = "force-dynamic";

const inputClass =
  "w-full min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] focus:border-brand-500 dark:border-white/15 dark:bg-zinc-900";

export default async function TaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const task = getTask(taskId);
  if (!task) notFound();

  const people = listActivePeople();
  const comments = listCommentsByTask(taskId);
  const activity = listActivityForEntity("task", taskId);
  const attachments = listAttachmentsByTask(taskId);
  const me = await getCurrentPerson();

  // Görevi açmak, bu görevle ilgili okunmamış bildirimleri (görev güncelleme
  // + @mention) okundu yapar — Panom'daki "🔔 Güncellendi" rozeti bu sayede
  // tekrar görülünce kaybolur. sweepArchivablePublishedTasks() ile aynı
  // "render'dan önce best-effort yan etki" deseni (bkz. app/panom/page.tsx).
  if (me) markTaskNotificationsReadForPerson(taskId, me.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <AutoRefresh />
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/brands" className="hover:text-zinc-800 dark:hover:text-zinc-200">
          Markalar
        </Link>{" "}
        /{" "}
        <Link
          href={`/brands/${task.brand_id}`}
          className="hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          {task.brand_name}
        </Link>{" "}
        /{" "}
        <Link
          href={`/brands/${task.brand_id}/content/${task.content_item_id}`}
          className="hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          {task.content_title}
        </Link>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
        <span className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          Tür
          <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
            {CONTENT_TYPE_LABEL[task.content_type]}
          </span>
        </span>
        <label className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          Durum
          <TaskStatusSelect taskId={task.id} status={task.status} />
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          Atanan
          <AssigneeSelect
            taskId={task.id}
            assigneeId={task.assignee_id}
            people={people}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          Öncelik
          <TaskPrioritySelect taskId={task.id} priority={task.priority} />
        </label>
        <TaskRepeatSelect taskId={task.id} repeatDays={task.repeat_days} />
      </div>

      {/* Yayınlanan iş panodan hemen düşmüyor; ne olacağı burada açıkça yazıyor
          ki yanlışlıkla işaretleyen kişi "görev silindi" sanmasın. */}
      {(task.status === "Yayinlandi" || task.archived_at !== null) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-zinc-50 p-4 text-sm dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-zinc-600 dark:text-zinc-300">
            {task.archived_at !== null ? (
              <>
                Bu görev <strong className="font-semibold">arşivde</strong> — panoda ve
                görev listesinde görünmüyor, ama silinmedi. Yanlışlıkla kapatıldıysa
                arşivden çıkarıp durumunu geri alabilirsin.
              </>
            ) : (
              <>
                Yayınlandı olarak işaretli. Panoda{" "}
                <strong className="font-semibold">
                  {daysUntilArchive(task.completed_at)} gün
                </strong>{" "}
                daha durup sonra arşive düşecek (yayından {ARCHIVE_AFTER_DAYS} gün
                sonra). Yanlışlıkla işaretlediysen yukarıdan durumunu değiştirmen
                yeterli.
              </>
            )}
          </p>
          <ArchiveTaskButton taskId={task.id} archived={task.archived_at !== null} />
        </div>
      )}

      {(task.repeat_days ?? 0) > 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Bu görev tekrar ediyor: “Yayınlandı” yapıldığında bir sonraki örneği
          otomatik açılır (teslim tarihi {task.repeat_days} gün ileri kayar).
        </p>
      )}

      <form
        action={updateTaskDetailsAction}
        className="space-y-3 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900"
      >
        <input type="hidden" name="taskId" value={task.id} />
        <label className="grid gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Görev başlığı
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={task.title}
            className={inputClass}
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Teslim tarihi
          <input
            type="date"
            name="dueDate"
            defaultValue={task.due_date ?? ""}
            className={`${inputClass} max-w-xs`}
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Notlar
          <textarea
            name="notes"
            rows={3}
            defaultValue={task.notes ?? ""}
            placeholder="Brief, referans linkleri, hatırlatmalar…"
            className={inputClass}
          />
        </label>
        <TaskNotesAttachments
          key={attachments.map((a) => a.id).join(",")}
          attachments={attachments}
        />
        <label className="grid gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Bildirim notu (opsiyonel)
          <input
            name="notifyMessage"
            maxLength={160}
            placeholder="Görev sahibine ve ekibine gidecek bildirimi kişiselleştir…"
            className={inputClass}
          />
          <span className="font-normal normal-case text-zinc-400 dark:text-zinc-500">
            Boş bırakırsan görev sahibine ve ekibine genel bir “görev güncellendi”
            bildirimi gider; buraya yazarsan onun yerine bu not gönderilir.
          </span>
        </label>
        <div className="flex items-center justify-between">
          {/* Ham <button type="submit"> yerine SubmitButton: useFormStatus ile
              gönderim sırasında kendini devre dışı bırakır (çift kayıt olmaz). */}
          <SubmitButton>Kaydet</SubmitButton>
          <DeleteTaskButton taskId={task.id} />
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Yorumlar ({comments.length})</h2>
        <ul className="space-y-2">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              canEdit={me?.id === c.author_id}
              people={people}
            />
          ))}
          {comments.length === 0 && (
            <li className="text-sm text-zinc-500 dark:text-zinc-400">Henüz yorum yok.</li>
          )}
        </ul>

        {me ? (
          <CommentForm taskId={task.id} />
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Yorum yazmak için{" "}
            <Link href="/whoami" className="font-medium text-brand-600 dark:text-brand-400">
              kim olduğunu seç
            </Link>
            .
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Hareketler</h2>
        <div className="rounded-xl border border-black/10 bg-white p-2 dark:border-white/10 dark:bg-zinc-900">
          <ActivityFeed
            entries={activity}
            showLink={false}
            emptyText="Bu görevde henüz kayıtlı hareket yok."
          />
        </div>
      </section>
    </div>
  );
}
