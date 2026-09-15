import Link from "next/link";
import MonthNavigator from "@/components/MonthNavigator";
import PageHeader from "@/components/ui/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import PointPackageBoard from "@/components/points/PointPackageBoard";
import { requireReportAccess } from "@/lib/identity";
import { monthParamISO, monthParamToDate } from "@/lib/date";
import { MONTHLY_TARGET_UNITS, POINT_PROFILE_LABEL } from "@/lib/points/catalog";
import { formatUnitsAsPoints, unitsToPoints } from "@/lib/points/units";
import { listPersonPointSummaries } from "@/lib/repositories/pointLedger";
import { listPointPackagesForMonth } from "@/lib/repositories/pointPackages";
import { listPersonPointProfiles } from "@/lib/repositories/pointCatalog";
import { listActivePeople } from "@/lib/repositories/people";

export const dynamic = "force-dynamic";

/** Hedefin üstü: max(toplam - hedef, 0). Ek iş puanı ile AYNI kavram değil. */
function aboveTargetUnits(totalUnits: number): number {
  return Math.max(0, totalUnits - MONTHLY_TARGET_UNITS);
}

export default async function EarnedPointsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireReportAccess();
  const { month: monthParam } = await searchParams;
  const month = monthParamISO(monthParamToDate(monthParam));

  const people = listActivePeople();
  const summaries = listPersonPointSummaries(month);
  const packages = listPointPackagesForMonth(month);
  const profiles = new Map(
    listPersonPointProfiles()
      .filter((row) => row.effective_from <= `${month}-01` && (row.effective_to === null || row.effective_to >= `${month}-01`))
      .map((row) => [row.person_id, row.profile]),
  );
  const activeIds = new Set(people.map((person) => person.id));
  // Pasife alınmış kişi de geçmiş hak edişiyle listede kalır; aktif olmayan
  // ve hiç puanı olmayan satırlar gizlenir.
  const rows = summaries.filter((row) => activeIds.has(row.person_id) || row.total_units !== 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="PUANLAMA"
        title="Kazanılmış puanlar"
        description="Puan yalnızca bütünü teslim edilip ekipçe onaylanmış paketlerden doğar. Kısmi puan yoktur; hak ediş, paketi tamamlayan son ekip onayının ayına yazılır."
        breadcrumb={[{ label: "Raporlar", href: "/reports" }, { label: "Puanlar" }]}
        actions={
          <>
            <MonthNavigator month={month} basePath="/reports/puan" />
            {/* Ekran ve Excel AYNI sorgudan besleniyor. */}
            <a href={`/reports/puan/export?month=${month}`} className={buttonClass({ variant: "secondary" })}>
              <Icon name="archive" className="size-4" />
              Excel indir
            </a>
            <Link href="/reports" className={buttonClass({ variant: "secondary" })}>
              <Icon name="reports" className="size-4" />
              Rapor merkezi
            </Link>
          </>
        }
      />

      <section className="overflow-x-auto rounded-xl border border-border-default bg-surface">
        <table className="w-full min-w-[820px] text-sm">
          <caption className="sr-only">Kişi bazında aylık kazanılmış puan</caption>
          <thead>
            <tr className="border-b border-border-default text-left text-[11px] tracking-[0.08em] text-muted">
              <th className="px-3 py-2 font-medium">Kişi</th>
              <th className="px-3 py-2 font-medium">Profil</th>
              <th className="px-3 py-2 font-medium">Temel iş</th>
              <th className="px-3 py-2 font-medium">Ek iş</th>
              <th className="px-3 py-2 font-medium">Yönetici</th>
              <th className="px-3 py-2 font-medium">Düzeltme</th>
              <th className="px-3 py-2 font-medium">Kazanılmış / hedef</th>
              <th className="px-3 py-2 font-medium">Hedef üstü</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const percent = Math.round((row.total_units / MONTHLY_TARGET_UNITS) * 100);
              const above = aboveTargetUnits(row.total_units);
              return (
                <tr key={row.person_id} className="border-b border-border-subtle last:border-0 hover:bg-surface-hover">
                  <td className="px-3 py-2">
                    <Link href={`/team/${row.person_id}`} className="font-medium hover:text-brand-600 dark:hover:text-brand-400">
                      {row.person_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {profiles.has(row.person_id)
                      ? POINT_PROFILE_LABEL[profiles.get(row.person_id)!]
                      : "Profil atanmadı"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatUnitsAsPoints(row.base_units)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatUnitsAsPoints(row.extra_units)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatUnitsAsPoints(row.manager_units)}</td>
                  <td className={`px-3 py-2 tabular-nums ${row.correction_units < 0 ? "text-danger" : "text-muted"}`}>
                    {row.correction_units === 0 ? "—" : formatUnitsAsPoints(row.correction_units)}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`font-semibold tabular-nums ${
                      row.total_units >= MONTHLY_TARGET_UNITS ? "text-success" : "text-foreground"
                    }`}>
                      {formatUnitsAsPoints(row.total_units)}
                    </span>
                    <span className="text-xs text-muted"> / {unitsToPoints(MONTHLY_TARGET_UNITS)}</span>
                    <span className="ml-2 text-xs text-muted tabular-nums">%{percent}</span>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-xs text-muted">
                    {above === 0 ? "—" : formatUnitsAsPoints(above)}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted">
                  Bu dönemde kazanılmış puan kaydı yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <PointPackageBoard month={month} packages={packages} />

      <p className="text-xs leading-5 text-muted">
        Bu ekran <strong>kazanılmış puanı</strong> gösterir; görev ağırlığı ve durum katsayısıyla
        hesaplanan operasyonel ilerleme ayrı bir ölçüdür ve <Link href="/reports" className="underline decoration-dotted">rapor merkezinde</Link> “eski
        hesaplama” etiketiyle durmaya devam eder. Sosyal stok raporundaki hazır adet, mesai süresi ve revize
        süresi puana çevrilmez.
      </p>
    </div>
  );
}
