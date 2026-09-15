import SocialStockReport from "@/components/SocialStockReport";
import EmptyState from "@/components/EmptyState";
import { requirePageSession } from "@/lib/identity";
import { todayISO } from "@/lib/date";
import { lastAssetUpdateByBrand, listBrandVarlikRows } from "@/lib/repositories/socialPlan";

export const dynamic = "force-dynamic";

export default async function SocialStockReportPage() {
  // Rapor mevcut sosyal bölüm yetkisiyle açık; ayrı bir kapı eklenmedi.
  await requirePageSession();
  const month = todayISO().slice(0, 7);
  const monthLabel = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "Europe/Istanbul" })
    .format(new Date(`${month}-01T12:00:00+03:00`));
  const rows = listBrandVarlikRows(month);
  const lastUpdates = Object.fromEntries(lastAssetUpdateByBrand());

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Stok / hedef raporu</h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          Marka ve tür bazında hazır stok, aylık hedef, eksik, fazla ve oran. Bu rapor GÜNCEL stoğu
          gösterir: geçmiş ayın stoğu bugünkü sayaçtan türetilmez. Stok, aylık üretim ya da Instagram
          yayın sayısı değildir.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Raporlanacak marka yok"
          description="Aktif bir marka eklendiğinde stok raporu burada oluşur."
        />
      ) : (
        <SocialStockReport rows={rows} lastUpdates={lastUpdates} monthLabel={monthLabel} />
      )}
    </div>
  );
}
