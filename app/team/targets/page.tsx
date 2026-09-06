import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import MonthlyPointTargetManagerDialog from "@/components/MonthlyPointTargetManagerDialog";
import MonthlyPointTargetReport from "@/components/MonthlyPointTargetReport";
import { buttonClass } from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { monthParamISO, monthParamToDate, todayISO } from "@/lib/date";
import { requirePageSession } from "@/lib/identity";
import { listMonthlyPointTargets, listPointTargetChanges } from "@/lib/repositories/monthlyPointTargets";

export const dynamic = "force-dynamic";

export default async function TeamTargetsPage({ searchParams }: { searchParams: Promise<{ month?: string; manage?: string }> }) {
  const person = await requirePageSession();
  const query = await searchParams;
  const month = monthParamISO(monthParamToDate(query.month));
  const canManage = person.is_manager === 1;
  const rows = listMonthlyPointTargets(month);
  const changes = canManage ? listPointTargetChanges(month) : [];

  return (
    <div className="w-full">
      <AutoRefresh />
      <PageHeader
        eyebrow="EKİP"
        title="Aylık hedefler"
        description="Ekip üyelerinin kişisel puan hedeflerini ve aylık gerçekleşmelerini takip edin."
        breadcrumb={[{ label: "Ekip", href: "/team" }, { label: "Aylık hedefler" }]}
        actionsClassName="lg:flex-nowrap"
        actions={
          <>
            {canManage && (
              <MonthlyPointTargetManagerDialog
                month={month}
                rows={rows}
                changes={changes}
                isPast={month < todayISO().slice(0, 7)}
                initialOpen={query.manage === "1"}
              />
            )}
            {canManage && (
              <a href={`/reports/export?view=targets&month=${month}`} className={buttonClass({ variant: "secondary" })}>
                Hedefleri Excel indir
              </a>
            )}
            <Link href="/team" className={buttonClass({ variant: "secondary" })}>Ekibe dön</Link>
          </>
        }
      />
      <MonthlyPointTargetReport month={month} basePath="/team/targets" />
    </div>
  );
}
