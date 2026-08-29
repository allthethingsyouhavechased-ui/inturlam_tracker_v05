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
import TaskDifficultySelect from "@/components/TaskDifficultySelect";
import TaskDetailTabs from "@/components/TaskDetailTabs";
import TaskDeliveryPanel from "@/components/TaskDeliveryPanel";
import TaskRepeatSelect from "@/components/TaskRepeatSelect";
import TaskRevisionPanel from "@/components/TaskRevisionPanel";
import TaskStatusSelect from "@/components/TaskStatusSelect";
import TaskWeightSelect from "@/components/TaskWeightSelect";
import PageHeader from "@/components/ui/PageHeader";
import { controlClass } from "@/components/ui/Input";
import { CONTENT_TYPES, CONTENT_TYPE_LABEL } from "@/lib/constants";
import { updateTaskDetailsAction } from "@/lib/actions/tasks";
import { addTeamSharedCommentAction } from "@/lib/actions/guestTasks";
import { canDeleteTasks } from "@/lib/auth/authorization";
import { requirePageSession } from "@/lib/identity";
import { canReviewClientRequests } from "@/lib/requestAccess";
import { listActivityForEntity } from "@/lib/repositories/activity";
import { listCommentsByTask } from "@/lib/repositories/comments";
import { getClientRequestByTask } from "@/lib/repositories/clientRequests";
import { listTaskDeliveries } from "@/lib/repositories/deliveries";
import { listActivePeople } from "@/lib/repositories/people";
import { listAttachmentsByTask } from "@/lib/repositories/taskAttachments";
import { getTask, listTaskRevisions } from "@/lib/repositories/tasks";
import { listSharedAttachments, listSharedComments } from "@/lib/repositories/guestTasks";
import { markTaskNotificationsReadForPerson } from "@/lib/repositories/notifications";
import { daysUntilArchive } from "@/lib/taskArchive";

export const dynamic = "force-dynamic";

const inputClass = controlClass();

export default async function TaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const me = await requirePageSession();
  const canDeleteTask = canDeleteTasks(me);
  const { taskId } = await params;
  const task = getTask(taskId);
  if (!task) notFound();

  const people = listActivePeople();
  const comments = listCommentsByTask(taskId);
  const activity = listActivityForEntity("task", taskId);
  const attachments = listAttachmentsByTask(taskId);
  const deliveries = listTaskDeliveries(taskId);
  const revisionRounds = listTaskRevisions(taskId);
  const sharedComments = task.origin === "guest" ? listSharedComments(taskId) : [];
  const sharedAttachments = task.origin === "guest" ? listSharedAttachments(taskId) : [];
  const sourceRequest = canReviewClientRequests(me)
    ? getClientRequestByTask(taskId)
    : undefined;
  // Görevi açmak, bu görevle ilgili okunmamış bildirimleri (görev güncelleme
  // + @mention) okundu yapar — Panom'daki "🔔 Güncellendi" rozeti bu sayede
  // tekrar görülünce kaybolur. sweepArchivablePublishedTasks() ile aynı
  // "render'dan önce best-effort yan etki" deseni (bkz. app/panom/page.tsx).
  markTaskNotificationsReadForPerson(taskId, me.id);

  return (
    <div>
      <AutoRefresh />
      <PageHeader
        eyebrow={CONTENT_TYPE_LABEL[task.content_type].toLocaleUpperCase("tr-TR")}
        title={task.title}
        description={`${task.brand_name} · ${task.content_title}`}
        breadcrumb={[
          { label: "Markalar", href: "/brands" },
          { label: task.brand_name, href: `/brands/${task.brand_id}` },
          { label: task.content_title, href: `/brands/${task.brand_id}/content/${task.content_item_id}` },
          { label: "Görev" },
        ]}
      />

      {task.origin === "guest" && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/20"><p className="font-semibold text-foreground">Guest tarafından açıldı · İstenen tarih {task.requested_date}</p><p className="mt-1 whitespace-pre-wrap text-xs text-secondary">{task.guest_brief}</p>{!task.due_date && <p className="mt-2 text-xs font-semibold text-warning">Planlanacak: iç teslim tarihini ve görev sahibini atayın.</p>}</div>}

      {(task.status === "Yayinlandi" || task.archived_at !== null) && (
        <div className="mb-5 rounded-xl border border-border-default bg-surface-subtle px-4 py-3 text-sm">
          <p className="text-secondary">
            {task.archived_at !== null
              ? "Bu görev arşivde; listelerde görünmüyor fakat kayıtları korunuyor."
              : `Yayınlandı; ${daysUntilArchive(task.completed_at)} gün sonra otomatik arşivlenecek.`}
          </p>
        </div>
      )}

      {sourceRequest && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-y border-border-subtle bg-surface-subtle px-4 py-3 text-xs">
          <p className="text-secondary">
            <span className="font-semibold text-foreground">Müşteri talebinden oluşturuldu</span>
            <span className="text-muted"> · {sourceRequest.requested_by_name ?? sourceRequest.created_by_name}</span>
          </p>
          <Link href={`/requests/${sourceRequest.id}`} className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline">
            Özgün briefi ve kararları aç
          </Link>
        </div>
      )}

      <TaskDetailTabs
        details={
          <form key="details" action={updateTaskDetailsAction} className="space-y-4 rounded-xl border border-border-default bg-surface p-4 sm:p-5">
            <div className="border-b border-border-subtle pb-4">
              <h2 className="text-base font-semibold text-foreground">Görev ayrıntıları</h2>
              <p className="mt-1 text-xs text-muted">Brief, teslim tarihi ve ekip bildirimini tek yerde güncelle.</p>
            </div>
            <input type="hidden" name="taskId" value={task.id} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem_13rem]">
              <label className="grid gap-1.5 text-xs font-medium text-secondary">
                Görev başlığı
                <input name="title" required maxLength={200} defaultValue={task.title} className={inputClass} />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-secondary">
                Görev türü
                <select name="contentType" required defaultValue={task.content_type} className={inputClass}>
                  {CONTENT_TYPES.map((type) => (
                    <option key={type} value={type}>{CONTENT_TYPE_LABEL[type]}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-secondary">
                Teslim tarihi
                <input type="date" name="dueDate" required defaultValue={task.due_date ?? ""} className={inputClass} />
              </label>
            </div>
            <label className="grid gap-1.5 text-xs font-medium text-secondary">
              Notlar
              <textarea name="notes" rows={6} defaultValue={task.notes ?? ""} placeholder="Brief, referans linkleri, hatırlatmalar…" className={inputClass} />
            </label>
            <TaskNotesAttachments key={attachments.map((a) => a.id).join(",")} attachments={attachments} />
            <label className="grid gap-1.5 text-xs font-medium text-secondary">
              Bildirim notu <span className="font-normal text-muted">(opsiyonel)</span>
              <input name="notifyMessage" maxLength={160} placeholder="Görev sahibine gidecek kısa not…" className={inputClass} />
              <span className="font-normal leading-5 text-muted">Boş bırakırsan standart görev güncelleme bildirimi gönderilir.</span>
            </label>
            <div className="flex items-center justify-between border-t border-border-subtle pt-4">
              <SubmitButton>Değişiklikleri kaydet</SubmitButton>
              {canDeleteTask && <DeleteTaskButton taskId={task.id} />}
            </div>
          </form>
        }
        delivery={
          <TaskDeliveryPanel
            key="delivery"
            taskId={task.id}
            taskStatus={task.status}
            taskOrigin={task.origin}
            planned={task.due_date !== null}
            archived={task.archived_at !== null}
            deliveries={deliveries}
          />
        }
        revision={
          <TaskRevisionPanel
            key="revision"
            taskId={task.id}
            status={task.status}
            archived={task.archived_at !== null}
            rounds={revisionRounds}
          />
        }
        comments={
          <div key="comments" className="space-y-5">
          <section className="rounded-xl border border-border-default bg-surface">
            <div className="border-b border-border-subtle px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold text-foreground">Yorumlar <span className="font-normal text-muted">· {comments.length}</span></h2>
            </div>
            <div className="space-y-3 p-4 sm:p-5">
              <ul className="space-y-2">
                {comments.map((comment) => (
                  <CommentItem key={comment.id} comment={comment} canEdit={me?.id === comment.author_id} people={people} />
                ))}
                {comments.length === 0 && <li className="py-4 text-center text-sm text-muted">Henüz yorum yok.</li>}
              </ul>
              {me ? (
                <CommentForm taskId={task.id} />
              ) : (
                <p className="text-sm text-muted">Yorum yazmak için <Link href="/whoami" className="font-medium text-brand-600">kim olduğunu seç</Link>.</p>
              )}
            </div>
          </section>

          {task.origin === "guest" && <section className="rounded-xl border border-border-default bg-surface"><div className="border-b border-border-subtle px-4 py-3 sm:px-5"><h2 className="text-sm font-semibold text-foreground">Guest ile paylaşılan konuşma</h2></div><div className="space-y-3 p-4 sm:p-5">{sharedComments.map((comment) => <div key={comment.id} className="rounded-lg bg-surface-subtle px-3 py-2"><p className="text-xs font-semibold text-foreground">{comment.author_name}</p><p className="mt-1 whitespace-pre-wrap text-sm text-secondary">{comment.body}</p></div>)}{sharedAttachments.length > 0 && <div className="flex flex-wrap gap-2">{sharedAttachments.map((attachment) => <a key={attachment.id} href={attachment.file_path} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand-600">{attachment.original_name ?? "Ek görsel"}</a>)}</div>}<form action={addTeamSharedCommentAction} className="space-y-2 border-t border-border-subtle pt-3"><input type="hidden" name="taskId" value={task.id} /><textarea name="body" required maxLength={2000} rows={3} placeholder="Guest’in göreceği yorumu yaz…" className={inputClass} /><input name="images" type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple className="text-xs" /><SubmitButton>Guest’e gönder</SubmitButton></form></div></section>}
          </div>
        }
        workflow={
          <section key="workflow" className="rounded-xl border border-border-default bg-surface p-4">
            <h2 className="text-eyebrow text-muted">İŞ AKIŞI</h2>
            <div className="mt-3 space-y-2.5">
              <label className="grid gap-1.5 text-xs font-medium text-muted">Durum<TaskStatusSelect taskId={task.id} status={task.status} locked={task.origin === "guest" && !task.due_date} />{task.origin === "guest" && !task.due_date && <span className="text-[10px] leading-4 text-amber-500">Durumu ilerletmek için önce iç teslim tarihini planlayın.</span>}</label>
              <label className="grid gap-1.5 text-xs font-medium text-muted">Atanan<AssigneeSelect taskId={task.id} assigneeId={task.assignee_id} people={people} /></label>
              <label className="grid gap-1.5 text-xs font-medium text-muted">Öncelik<TaskPrioritySelect taskId={task.id} priority={task.priority} /></label>
              <label className="grid gap-1.5 text-xs font-medium text-muted">Zorluk<TaskDifficultySelect taskId={task.id} difficulty={task.difficulty} /></label>
              {me.is_manager === 1 && <label className="grid gap-1.5 text-xs font-medium text-muted">Ağırlık puanı<TaskWeightSelect taskId={task.id} weight={task.weight_points} /></label>}
              <div className="grid gap-1.5 text-xs font-medium text-muted"><span>Tekrar</span><TaskRepeatSelect taskId={task.id} repeatDays={task.repeat_days} /></div>
            </div>
            {(task.repeat_days ?? 0) > 0 && (
              <p className="mt-3 border-t border-border-subtle pt-3 text-[11px] leading-5 text-muted">Yayınlandığında {task.repeat_days} gün ileri tarihli yeni görev açılır.</p>
            )}
            <div className="mt-3 border-t border-border-subtle pt-3">
              <ArchiveTaskButton
                taskId={task.id}
                archived={task.archived_at !== null}
                published={task.status === "Yayinlandi"}
              />
            </div>
          </section>
        }
        activity={
          <section key="activity" className="overflow-hidden rounded-xl border border-border-default bg-surface">
            <div className="border-b border-border-subtle px-4 py-2.5">
              <h2 className="text-eyebrow text-muted">HAREKETLER</h2>
            </div>
            {/* Yan sütunda duruyor: uzun bir geçmiş sayfayı aşağı doğru
                uzatmasın, kendi içinde kaysın. */}
            <div className="max-h-[24rem] overflow-y-auto overscroll-contain">
              <ActivityFeed entries={activity} showLink={false} emptyText="Bu görevde henüz hareket yok." />
            </div>
          </section>
        }
      />
    </div>
  );
}
