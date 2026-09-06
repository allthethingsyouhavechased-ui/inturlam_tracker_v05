import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { requirePageSession } from "@/lib/identity";
import { listPlanningPage } from "@/lib/repositories/taskListing";
import { parseTaskPage } from "@/lib/taskPagination";
export const dynamic = "force-dynamic";
export default async function PlanningPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const me = await requirePageSession();
  const result = listPlanningPage(me.id,parseTaskPage((await searchParams).page));
  return <div>
    <PageHeader title="Tarih bekleyenler" description="İç teslim tarihi atanacak işler." breadcrumb={[{ label: "Görevler", href: "/tasks" }, { label: "Tarih bekleyenler" }]} />
    <p className="mb-3 text-sm text-muted">{result.total} görev · Sayfa {result.page} / {result.pages}</p>
    <ul className="divide-y divide-border-subtle rounded-xl border border-border-default bg-surface">{result.tasks.map(task => <li key={task.id}><Link className="block px-4 py-3 hover:bg-surface-hover" href={`/tasks/${task.id}`}><strong>{task.title}</strong><span className="block text-xs text-muted">{task.brand_name} · {task.origin === "guest" ? "Müşteri talebi" : "Tarihsiz ekip işi"}{task.requested_date ? ` · İstenen: ${task.requested_date}` : ""}</span></Link></li>)}</ul>
    {result.total === 0 && <p className="py-8 text-muted">Tarih bekleyen görev yok.</p>}
    <nav aria-label="Planlama sayfaları" className="mt-4 flex gap-4">{result.page > 1 && <Link href={`/tasks/planning?page=${result.page-1}`}>Önceki</Link>}{result.page < result.pages && <Link href={`/tasks/planning?page=${result.page+1}`}>Sonraki</Link>}</nav>
  </div>;
}
