import Link from "next/link";
import MonthlyPackageBuilder from "@/components/points/MonthlyPackageBuilder";
import MonthlyPlanList from "@/components/points/MonthlyPlanList";
import PageHeader from "@/components/ui/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { monthParamISO, monthParamToDate } from "@/lib/date";
import { requireManager } from "@/lib/identity";
import { listBrandsAlphabetically } from "@/lib/repositories/brands";
import { listActivePeople } from "@/lib/repositories/people";
import { listMonthlyTaskPlans } from "@/lib/repositories/monthlyPlans";

export const dynamic = "force-dynamic";

export default async function MonthlyPlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  // Paketler YALNIZCA yönetici önizlemesiyle açılır; patch kurulunca kimseye
  // otomatik kota görevi üretilmez.
  await requireManager();
  const { month: monthParam } = await searchParams;
  const month = monthParamISO(monthParamToDate(monthParam));
  const brands = listBrandsAlphabetically();
  const people = listActivePeople();
  const plans = listMonthlyTaskPlans();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AYLIK ÜRETİM"
        title="Aylık paket ve otomasyon"
        description="Katalog kalemine bağlı toplu görev üretimi ve isteğe bağlı aylık otomasyon. Üretim, gerçekten seçilen markalarla yapılır; referans marka sayıları zorunlu atama ya da gizli çarpan değildir."
        breadcrumb={[{ label: "Görevler", href: "/tasks" }, { label: "Aylık paket" }]}
        actions={
          <Link href="/reports/puan" className={buttonClass({ variant: "secondary" })}>
            <Icon name="reports" className="size-4" />
            Kazanılmış puanlar
          </Link>
        }
      />

      <MonthlyPackageBuilder
        brands={brands.map((brand) => ({ id: brand.id, name: brand.name }))}
        people={people.map((person) => ({ id: person.id, name: person.name }))}
        defaultMonth={month}
      />

      <MonthlyPlanList
        plans={plans}
        brands={brands.map((brand) => ({ id: brand.id, name: brand.name }))}
        people={people.map((person) => ({ id: person.id, name: person.name }))}
        defaultMonth={month}
      />
    </div>
  );
}
