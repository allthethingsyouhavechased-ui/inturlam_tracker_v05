/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import ActionForm from "@/components/ActionForm";
import RequestImagePicker from "@/components/RequestImagePicker";
import GuestDeliveryPanel from "@/components/GuestDeliveryPanel";
import SubmitButton from "@/components/SubmitButton";
import PageHeader from "@/components/ui/PageHeader";
import { addGuestSharedCommentAction, deleteGuestSharedAttachmentAction, updateGuestTaskAction } from "@/lib/actions/guestTasks";
import { TASK_STATUS_LABEL } from "@/lib/constants";
import { requireGuestSession } from "@/lib/identity";
import { getGuestTask } from "@/lib/repositories/guestTasks";

export const dynamic = "force-dynamic";

export default async function GuestTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const actor = await requireGuestSession();
  const task = getGuestTask((await params).taskId, actor.brand.id, actor.account_id);
  if (!task) notFound();
  return (
    <div>
      <PageHeader eyebrow={TASK_STATUS_LABEL[task.status].toLocaleUpperCase("tr-TR")} title={task.title} description={`${task.brand_name} · İstenen tarih ${task.requested_date || "belirtilmedi"}`} breadcrumb={[{ label: actor.brand.name, href: "/guest" }, { label: "Görevler", href: "/guest/tasks" }, { label: task.title }]} />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <section className="rounded-xl border border-border-default bg-surface p-4 sm:p-5">{task.editable ? <ActionForm action={updateGuestTaskAction} successMessage="Brief güncellendi." className="space-y-4"><input type="hidden" name="taskId" value={task.id} /><label className="grid gap-1.5 text-xs font-medium text-secondary">Başlık<input name="title" required maxLength={200} defaultValue={task.title} className="min-h-10 rounded-lg border border-border-default bg-background px-3 text-sm" /></label><label className="grid gap-1.5 text-xs font-medium text-secondary">Brief<textarea name="brief" required maxLength={5000} rows={8} defaultValue={task.brief} className="rounded-lg border border-border-default bg-background px-3 py-2 text-sm" /></label><label className="grid gap-1.5 text-xs font-medium text-secondary">İstenen tarih<input name="requestedDate" type="date" required defaultValue={task.requested_date} className="min-h-10 rounded-lg border border-border-default bg-background px-3 text-sm" /></label><SubmitButton pendingLabel="Güncelleniyor…" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70">Briefi güncelle</SubmitButton></ActionForm> : <div><h2 className="text-sm font-semibold text-foreground">Brief</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-secondary">{task.brief}</p><p className="mt-4 rounded-lg bg-surface-subtle px-3 py-2 text-xs text-muted">Bu brief ekip tarafından yönetiliyor. Yeni bilgileri yorum olarak ekleyebilirsiniz.</p></div>}</section>
          <GuestDeliveryPanel deliveries={task.deliveries} />
          <section className="rounded-xl border border-border-default bg-surface"><div className="border-b border-border-subtle px-4 py-3"><h2 className="text-sm font-semibold text-foreground">Paylaşılan konuşma</h2></div><div className="space-y-3 p-4">{task.comments.map((comment) => <div key={comment.id} className="rounded-lg bg-surface-subtle px-3 py-2"><div className="text-xs font-semibold text-foreground">{comment.author_name}</div><p className="mt-1 whitespace-pre-wrap text-sm text-secondary">{comment.body}</p></div>)}{task.comments.length === 0 && <p className="text-sm text-muted">Henüz yorum yok.</p>}<ActionForm action={addGuestSharedCommentAction} successMessage="Yorum gönderildi." resetOnSuccess className="space-y-2 border-t border-border-subtle pt-3"><input type="hidden" name="taskId" value={task.id} /><textarea name="body" required maxLength={2000} rows={3} placeholder="Yorum ekle…" className="w-full rounded-lg border border-border-default bg-background px-3 py-2 text-sm" /><RequestImagePicker /><SubmitButton pendingLabel="Gönderiliyor…" className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-wait disabled:opacity-70">Gönder</SubmitButton></ActionForm></div></section>
        </div>
        <aside className="rounded-xl border border-border-default bg-surface p-4"><p className="text-xs font-semibold tracking-wide text-muted">PAYLAŞILAN EKLER</p><div className="mt-3 grid grid-cols-2 gap-2">{task.attachments.map((attachment) => <div key={attachment.id} className="space-y-1"><a href={attachment.file_path} target="_blank" rel="noreferrer"><img src={attachment.file_path} alt={attachment.original_name ?? "Ek"} className="aspect-square w-full rounded-lg border border-border-default object-cover" /></a>{task.editable && attachment.can_delete && <ActionForm action={deleteGuestSharedAttachmentAction.bind(null, task.id, attachment.id)}><SubmitButton pendingLabel="Kaldırılıyor…" className="w-full text-[10px] font-semibold text-red-600 disabled:cursor-wait disabled:opacity-60">Kaldır</SubmitButton></ActionForm>}</div>)}</div>{task.attachments.length === 0 && <p className="mt-3 text-sm text-muted">Ek yok.</p>}</aside>
      </div>
    </div>
  );
}
