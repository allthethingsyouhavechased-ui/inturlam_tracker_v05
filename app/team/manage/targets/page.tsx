import { notFound } from "next/navigation";
import Link from "next/link";
import MonthlyPointTargetEditor from "@/components/MonthlyPointTargetEditor";
import MonthNavigator from "@/components/MonthNavigator";
import PageHeader from "@/components/ui/PageHeader";
import { monthParamISO, monthParamToDate, todayISO, formatIsoDateTime } from "@/lib/date";
import { requirePageSession } from "@/lib/identity";
import { listMonthlyPointTargets, listPointTargetChanges } from "@/lib/repositories/monthlyPointTargets";

export const dynamic = "force-dynamic";

export default async function MonthlyPointTargetsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const actor = await requirePageSession();
  if (actor.is_manager !== 1) notFound();
  const month = monthParamISO(monthParamToDate((await searchParams).month));
  const rows = listMonthlyPointTargets(month);
  const changes = listPointTargetChanges(month);
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader eyebrow="EKİP YÖNETİMİ" title="Aylık puan hedefleri"
        description="Her kişinin aylık hedefini belirleyin. Ek iş atamak hedefi artırmaz; kazanılan puan ve gerçekleşme %100'ü aşabilir."
        breadcrumb={[{ label: "Ekip", href: "/team" }, { label: "Aylık hedefler", href: `/team/targets?month=${month}` }, { label: "Hedefleri düzenle" }]}
        actions={<MonthNavigator month={month} basePath="/team/manage/targets" ariaLabel="Hedef yönetim ayı" />} />
      <MonthlyPointTargetEditor key={month} month={month} rows={rows} isPast={month < todayISO().slice(0, 7)} />
      <p className="text-xs text-muted">Kazanım, iç teslim tarihi bu aya düşen görevlerin durum katsayılarıyla hesaplanır. Henüz tamamlanmamış işlerin aşama katkısı da dahildir. Hedefler sonraki aya otomatik taşınmaz.</p>
      <Link href={`/team/targets?month=${month}`} className="text-sm font-semibold text-brand-600 hover:underline">Ekip gerçekleşmesini gör →</Link>
      <details className="rounded-xl border border-border-default bg-surface p-4">
        <summary className="cursor-pointer text-sm font-semibold">Hedef değişiklik geçmişi · {month}</summary>
        <p className="mt-2 text-xs text-muted">Bu ayın son 100 değişikliği.</p>
        <ul className="mt-3 space-y-3">
          {changes.map(change => <li key={change.id} className="border-t border-border-subtle pt-3 text-sm">
            <p className="font-medium">{change.person_name}: {change.previous_points ?? "Hedef yok"} → {change.target_points} puan</p>
            <p className="mt-1 text-xs text-muted">{change.actor_name} · {formatIsoDateTime(change.created_at)}</p>
            {change.note && <p className="mt-1 text-xs text-secondary">{change.note}</p>}
          </li>)}
          {!changes.length && <li className="text-xs text-muted">Henüz hedef değişikliği yok.</li>}
        </ul>
      </details>
    </div>
  );
}
