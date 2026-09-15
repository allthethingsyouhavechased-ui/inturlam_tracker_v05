import EmptyState from "@/components/EmptyState";
import SocialVarlikTable from "@/components/SocialVarlikTable";
import { setBrandAssetCountAction } from "@/lib/actions/socialPlan";
import { requirePageSession } from "@/lib/identity";
import { listBrandVarlikRows } from "@/lib/repositories/socialPlan";
import { todayISO } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function SocialVarlikPage() {
  await requirePageSession();
  const month = todayISO().slice(0, 7);
  const monthLabel = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "Europe/Istanbul" })
    .format(new Date(`${month}-01T12:00:00+03:00`));
  // Sıralama istemcide: sütun başlığına her tıklamada sunucuya gidilirse
  // liste yeniden yükleniyor ve sayaç düzenleme odağı kayboluyordu.
  const rows = listBrandVarlikRows(month);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Hazır içerik varlığı</h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          Yayına hazır canlı stok ve marka bazlı aylık hedef karşılaştırması. İçerikler paylaşıldıkça stok azalır; bu azalma eksik teslim anlamına gelmez. Aylık teslim durumu marka sayfasından ayrıca işaretlenir. Sütun başlığına tıklayarak Post, Story veya Reels sayısına göre sıralayabilirsin.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Takip edilecek marka yok"
          description="Aktif bir marka eklendiğinde varlık takibi burada başlar."
        />
      ) : (
        <SocialVarlikTable
          rows={rows}
          monthLabel={monthLabel}
          setAssetCountAction={setBrandAssetCountAction}
        />
      )}
    </div>
  );
}
