import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import MonthlyPointTargetReport from "@/components/MonthlyPointTargetReport";
import { buttonClass } from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { monthParamISO, monthParamToDate } from "@/lib/date";
import { requirePageSession } from "@/lib/identity";

export const dynamic = "force-dynamic";

export default async function TeamTargetsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const person = await requirePageSession();
  const month = monthParamISO(monthParamToDate((await searchParams).month));
  const canManage = person.is_manager === 1;

  return (
    <div className="w-full">
      <AutoRefresh />
      <PageHeader
        eyebrow="EKİP"
        title="Aylık hedefler"
        description="Ekip üyelerinin kişisel puan hedeflerini ve aylık gerçekleşmelerini takip edin."
        breadcrumb={[{ label: "Ekip", href: "/team" }, { label: "Aylık hedefler" }]}
        actions={<Link href="/team" className={buttonClass({ variant: "secondary" })}>Ekibe dön</Link>}
      />
      <MonthlyPointTargetReport month={month} basePath="/team/targets" canManage={canManage} canExport={canManage} />
    </div>
  );
}
