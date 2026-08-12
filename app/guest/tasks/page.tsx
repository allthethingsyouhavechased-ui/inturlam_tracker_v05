import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { createGuestTaskAction } from "@/lib/actions/guestTasks";
import { TASK_STATUS_LABEL } from "@/lib/constants";
import { requireGuestSession } from "@/lib/identity";
import { listGuestTasks } from "@/lib/repositories/guestTasks";

export const dynamic = "force-dynamic";

export default async function GuestTasksPage() {
  const actor = await requireGuestSession();
  const tasks = listGuestTasks(actor.brand.id);
  return (
    <div>
      <PageHeader eyebrow="MARKA PORTALI" title="Görevler" description="Yeni bir iş talebi açın ve ekibin ilerleyişini takip edin." breadcrumb={[{ label: actor.brand.name, href: "/guest" }, { label: "Görevler" }]} />
      <div className="grid items-start gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <form action={createGuestTaskAction} className="space-y-4 rounded-xl border border-border-default bg-surface p-4"><h2 className="text-sm font-semibold text-foreground">Yeni görev aç</h2><label className="grid gap-1.5 text-xs font-medium text-secondary">Başlık<input name="title" required maxLength={200} className="min-h-10 rounded-lg border border-border-default bg-background px-3 text-sm" /></label><label className="grid gap-1.5 text-xs font-medium text-secondary">Brief<textarea name="brief" required maxLength={5000} rows={6} className="rounded-lg border border-border-default bg-background px-3 py-2 text-sm" /></label><label className="grid gap-1.5 text-xs font-medium text-secondary">İstenen tarih<input name="requestedDate" type="date" required className="min-h-10 rounded-lg border border-border-default bg-background px-3 text-sm" /></label><label className="grid gap-1.5 text-xs font-medium text-secondary">Görseller<input name="images" type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple className="text-xs" /></label><button className="min-h-10 w-full rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-500">Görevi gönder</button><p className="text-[11px] leading-5 text-muted">İstenen tarih talebinizi belirtir. Ekibin iç teslim tarihi ayrıca planlanır ve paylaşılmaz.</p></form>
        <section className="overflow-hidden rounded-xl border border-border-default bg-surface"><div className="divide-y divide-border-subtle">{tasks.map((task) => <Link key={task.id} href={`/guest/tasks/${task.id}`} className="block px-4 py-3 hover:bg-surface-hover"><div className="flex items-center justify-between gap-3"><span className="truncate text-sm font-semibold text-foreground">{task.title}</span><span className="shrink-0 rounded-md bg-surface-subtle px-2 py-1 text-[11px] text-secondary">{TASK_STATUS_LABEL[task.status]}</span></div><p className="mt-1 text-xs text-muted">İstenen tarih: {task.requested_date}{task.editable ? " · Brief düzenlenebilir" : " · Brief kilitli"}</p></Link>)}{tasks.length === 0 && <p className="p-6 text-center text-sm text-muted">Henüz görev açılmadı.</p>}</div></section>
      </div>
    </div>
  );
}
